from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Tuple
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
import itertools
import math
from time import perf_counter

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SimulationRequest(BaseModel):
    qubits: int
    gate: str

class Applicant(BaseModel):
    id: int
    appNo: str
    name: str
    course: str
    major: str
    isPWD: bool

class Room(BaseModel):
    id: int
    roomId: str
    capacity: int
    buildingId: str

class ScheduleRequest(BaseModel):
    applicants: List[Applicant]
    rooms: List[Room]
    timeSlots: List[str]
    qubits: int          # kept for API compatibility; batching ignores this cap
    iterations: int      # grid density

@app.get("/")
def root():
    return {"message": "FastAPI Quantum (manual QAOA) Scheduler running."}

@app.post("/simulate")
def simulate(req: SimulationRequest):
    qc = QuantumCircuit(req.qubits, req.qubits)
    if req.gate == "bell" and req.qubits >= 2:
        qc.h(0); qc.cx(0, 1)
    elif req.gate == "hadamard":
        for i in range(req.qubits): qc.h(i)
    elif req.gate == "identity":
        pass
    else:
        return {"error": "Unsupported gate or invalid qubit count"}
    qc.measure(range(req.qubits), range(req.qubits))
    sim = AerSimulator()
    res = sim.run(qc, shots=1024).result()
    return res.get_counts(qc)

# ---------------- QAOA (manual, Aer-based) ----------------

def build_cost_coeffs(applicants: List[Applicant], max_qubits: int) -> Tuple[list, list]:
    """
    Build Ising cost H = sum_i h_i Z_i + sum_{i<j} J_ij Z_i Z_j
    - PWD favored via more negative h_i (encourages bit=1)
    - Small positive J_ij discourages picking all 1s (regularization)
    """
    n = min(len(applicants), max_qubits)
    if n == 0:
        n = 2
    h = []
    for i in range(n):
        h.append(-2.0 if applicants[i].isPWD else -1.0)
    J = []
    lam = 0.15
    for i in range(n):
        for j in range(i + 1, n):
            J.append((i, j, lam))
    return h, J

def qaoa_layer(qc: QuantumCircuit, beta: float, gamma: float, h: list, J: list):
    # Cost unitary U_C(gamma)
    for i, hi in enumerate(h):
        qc.rz(2.0 * gamma * hi, i)
    for (i, j, Jij) in J:
        qc.cx(i, j)
        qc.rz(2.0 * gamma * Jij, j)
        qc.cx(i, j)
    # Mixer unitary U_B(beta)
    for q in range(len(h)):
        qc.rx(2.0 * beta, q)

def build_qaoa_circuit(n: int, h: list, J: list, beta: float, gamma: float, reps: int = 1) -> QuantumCircuit:
    qc = QuantumCircuit(n, n)
    for q in range(n):
        qc.h(q)
    for _ in range(reps):
        qaoa_layer(qc, beta, gamma, h, J)
    qc.measure(range(n), range(n))
    return qc

def bitstring_energy(bitstr: str, h: list, J: list) -> float:
    # Map |0>=+1, |1>=-1
    z = [1 if b == "0" else -1 for b in bitstr[::-1]]  # reverse key-endian
    e = 0.0
    for i, hi in enumerate(h):
        e += hi * z[i]
    for (i, j, Jij) in J:
        e += Jij * z[i] * z[j]
    return e

def expectation_from_counts(counts: Dict[str, int], h: list, J: list) -> float:
    shots = sum(counts.values())
    if shots == 0:
        return 0.0
    exp = 0.0
    for bitstr, c in counts.items():
        exp += (c / shots) * bitstring_energy(bitstr, h, J)
    return exp

def grid_search_params(iters: int):
    # Small grid for (beta, gamma)
    k = max(3, min(10, iters // 99999999 if iters > 0 else 5))
    grid = [i * (math.pi / (2 * (k - 1))) for i in range(k)]
    return list(itertools.product(grid, grid))

@app.post("/schedule-qaoa")
def schedule_with_qaoa(req: ScheduleRequest):
    applicants = req.applicants
    rooms = req.rooms
    slots = req.timeSlots

    num_applicants = len(applicants)
    if num_applicants == 0 or len(rooms) == 0 or len(slots) == 0:
        return {
            "success": False,
            "assignments": [],
            "quantum_metrics": {"error": "No applicants/rooms/timeSlots provided"},
            "total_scheduled": 0,
            "total_unscheduled": num_applicants,
            "duration_seconds": 0.0,
            "placement_stats": {}
        }

    t0 = perf_counter()

    # Map applicant id -> isPWD for stats
    is_pwd_by_id = {a.id: a.isPWD for a in applicants}

    # Build capacity per room per slot and compute totals
    cap = {(r.id, s): r.capacity for r in rooms for s in slots}
    total_capacity = sum(cap.values())
    placed_by_room: Dict[str, int] = {r.id: 0 for r in rooms}
    placed_by_building: Dict[str, int] = {}
    for r in rooms:
        placed_by_building[r.buildingId] = 0

    # Work on a copy; batch in rounds up to batch_size qubits per round
    remaining = list(applicants)
    assignments = []
    rounds_metrics = []
    sim = AerSimulator()

    def capacity_left():
        return sum(cap.values())

    # Batch size capped for feasibility (e.g., 20 qubits per round)
    batch_cap = 99999999

    while remaining and capacity_left() > 0:
        n = min(max(2, min(len(remaining), batch_cap)), batch_cap)
        sub = remaining[:n]  # window of remaining applicants
        h, J = build_cost_coeffs(sub, n)

        best = {"energy": float("inf"), "beta": 0.0, "gamma": 0.0, "counts": {}}
        for beta, gamma in grid_search_params(req.iterations):
            qc = build_qaoa_circuit(n, h, J, beta, gamma, reps=1)
            result = sim.run(qc, shots=1024).result()
            counts = result.get_counts(qc)
            energy = expectation_from_counts(counts, h, J)
            if energy < best["energy"]:
                best = {"energy": energy, "beta": beta, "gamma": gamma, "counts": counts}

        if not best["counts"]:
            break

        best_bitstring = max(best["counts"], key=best["counts"].get)
        bits = [int(b) for b in best_bitstring[::-1]]
        idx_with_bits = list(enumerate(sub))
        # Quantum-prioritized: ones first, then PWD, then applicant id
        idx_with_bits.sort(key=lambda t: (-bits[t[0]], -(1 if t[1].isPWD else 0), t[1].id))

        # Place as many as capacity allows this round
        can_place = min(n, capacity_left())
        picked = [a for _, a in idx_with_bits[:can_place]]

        placed_ids = set()
        placed_this_round = 0
        for a in picked:
            assigned = False
            for s in slots:
                for r in rooms:
                    key = (r.id, s)
                    if cap[key] > 0:
                        assignments.append({
                            "applicant_id": a.id,
                            "room_id": r.id,
                            "time_slot": s
                        })
                        cap[key] -= 1
                        placed_by_room[r.id] += 1
                        placed_by_building[r.buildingId] = placed_by_building.get(r.buildingId, 0) + 1
                        placed_ids.add(a.id)
                        placed_this_round += 1
                        assigned = True
                        break
                if assigned:
                    break

        # Remove placed from remaining
        remaining = [a for a in remaining if a.id not in placed_ids]

        rounds_metrics.append({
            "energy": round(best["energy"], 6),
            "beta": best["beta"],
            "gamma": best["gamma"],
            "shots": sum(best["counts"].values()),
            "most_probable_bitstring": best_bitstring,
            "placed_this_round": placed_this_round,
            "remaining_applicants": len(remaining),
            "remaining_capacity": capacity_left(),
        })

        if placed_this_round == 0:
            # Avoid infinite loop if nothing gets placed
            break

    duration = perf_counter() - t0

    pwd_scheduled = sum(1 for a in assignments if is_pwd_by_id.get(a["applicant_id"], False))

    quantum_metrics = {
        "rounds": rounds_metrics,
        "total_shots": sum(r["shots"] for r in rounds_metrics) if rounds_metrics else 0,
    }

    placement_stats = {
        "total_capacity": total_capacity,
        "placed_by_room": placed_by_room,
        "placed_by_building": placed_by_building,
        "pwd_scheduled": pwd_scheduled,
    }

    return {
        "success": True,
        "assignments": assignments,
        "quantum_metrics": quantum_metrics,
        "total_scheduled": len(assignments),
        "total_unscheduled": num_applicants - len(assignments),
        "duration_seconds": round(duration, 4),
        "placement_stats": placement_stats,
    }
