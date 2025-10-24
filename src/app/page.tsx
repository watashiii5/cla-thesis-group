import React, { useState } from 'react';

type Campus = { id: string; name: string };
type Building = { id: string; name: string };
type Room = { id: string; capacity: string };
type Applicant = { appNo: string; course: string; major: string; time: string };

const ATBulSUSchedule = () => {
  const [currentView, setCurrentView] = useState<'campuses' | 'buildings' | 'rooms' | 'applicants'>('campuses');
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const campuses: Campus[] = [
    { id: 'main', name: 'MAIN CAMPUS' },
    { id: 'sarmiento', name: 'SARMIENTO' },
    { id: 'hagonoy', name: 'HAGONOY' },
    { id: 'sanrafael', name: 'SAN RAFAEL' },
    { id: 'meneses', name: 'MENESES' },
    { id: 'bustos', name: 'BUSTOS' }
  ];

  const buildings: Record<string, Building[]> = {
    main: [
      { id: 'fed', name: 'FED HALL' },
      { id: 'alvarado', name: 'ALVARADO HALL' },
      { id: 'roxas', name: 'roxas hall' },
      { id: 'pimentel', name: 'pimentel' }
    ]
  };

  const rooms: Record<string, Room[]> = {
    fed: [
      { id: '101', capacity: '30/30' },
      { id: '102', capacity: '30/30' },
      { id: '103', capacity: '30/30' },
      { id: '104', capacity: '30/30' },
      { id: '105', capacity: '30/30' },
      { id: '201', capacity: '30/30' },
      { id: '202', capacity: '30/30' },
      { id: '203', capacity: '30/30' },
      { id: '204', capacity: '30/30' },
      { id: '205', capacity: '30/30' },
      { id: '301', capacity: '30/30' },
      { id: '302', capacity: '30/30' },
      { id: '303', capacity: '30/30' },
      { id: '304', capacity: '30/30' },
      { id: '305', capacity: '30/30' }
    ]
  };

  const applicants: Applicant[] = [
    { appNo: '2024-0001', course: 'BS MATH', major: 'Comscie', time: '8:00 -12:00' },
    { appNo: '2024-0001', course: 'BS MATH', major: 'Comscie', time: '8:00 -12:00' },
    { appNo: '2024-0001', course: 'BS MATH', major: 'Comscie', time: '8:00 -12:00' },
    { appNo: '2024-0001', course: 'BS MATH', major: 'Comscie', time: '8:00 -12:00' },
    { appNo: '2024-0001', course: 'BS MATH', major: 'Comscie', time: '8:00 -12:00' },
    { appNo: '2024-0001', course: 'BS MATH', major: 'Comscie', time: '8:00 -12:00' },
    { appNo: '2024-0001', course: 'BS MATH', major: '', time: '' },
    { appNo: '2024-0001', course: 'BS MATH', major: '', time: '' },
    { appNo: '2024-0001', course: 'BS MATH', major: '', time: '' },
    { appNo: '2024-0001', course: 'BS MATH', major: '', time: '' },
    { appNo: '2024-0001', course: 'BS MATH', major: '', time: '' },
    { appNo: '2024-0001', course: 'BS MATH', major: '', time: '' },
    { appNo: '2024-0001', course: 'BS MATH', major: '', time: '' },
    { appNo: '2024-0001', course: 'BS MATH', major: '', time: '' },
    { appNo: '2024-0001', course: 'BS MATH', major: '', time: '' },
  ];

  const handleCampusSelect = (campus: Campus) => {
    setSelectedCampus(campus);
    setCurrentView('buildings');
  };

  const handleBuildingSelect = (building: Building) => {
    setSelectedBuilding(building);
    setCurrentView('rooms');
  };

  const handleRoomSelect = (room: Room) => {
    setSelectedRoom(room);
    setCurrentView('applicants');
  };

  const handleBack = () => {
    if (currentView === 'applicants') {
      setCurrentView('rooms');
      setSelectedRoom(null);
    } else if (currentView === 'rooms') {
      setCurrentView('buildings');
      setSelectedBuilding(null);
    } else if (currentView === 'buildings') {
      setCurrentView('campuses');
      setSelectedCampus(null);
    }
  };

  const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.35-4.35"></path>
    </svg>
  );

  const BellIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>
  );

  const UserIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );

  const MenuIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  );

  const HelpIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  );

  const Sidebar = () => (
    <div className="w-32 bg-gray-200 h-screen flex flex-col">
      <div className="p-4 border-b border-gray-300">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">Q</span>
          </div>
          <span className="font-semibold text-sm">time</span>
        </div>
      </div>
      
      <nav className="flex-1 py-4">
        <div className="px-3 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-300 cursor-pointer">
          <div className="w-4 h-4 bg-gray-400 rounded"></div>
          <span>Dashboard</span>
        </div>
        <div className="px-3 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-300 cursor-pointer">
          <div className="w-4 h-4 bg-gray-400 rounded"></div>
          <span>Calendar</span>
        </div>
        <div className="px-3 py-2 text-sm flex items-center gap-2 bg-gray-300 cursor-pointer">
          <div className="w-4 h-4 bg-gray-600 rounded"></div>
          <span>ATBulSU Schedule</span>
        </div>
        <div className="px-3 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-300 cursor-pointer">
          <div className="w-4 h-4 bg-gray-400 rounded"></div>
          <span>Students</span>
        </div>
        <div className="px-3 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-300 cursor-pointer">
          <div className="w-4 h-4 bg-gray-400 rounded"></div>
          <span>Messages</span>
        </div>
        <div className="px-3 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-300 cursor-pointer">
          <div className="w-4 h-4 bg-gray-400 rounded"></div>
          <span>Notifications</span>
        </div>
        <div className="px-3 py-2 text-sm flex items-center gap-2 text-gray-700 hover:bg-gray-300 cursor-pointer">
          <div className="w-4 h-4 bg-gray-400 rounded"></div>
          <span>Setting</span>
        </div>
      </nav>

      <div className="p-4 border-t border-gray-300">
        <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900">
          <HelpIcon />
          <span>need help?</span>
        </button>
      </div>
    </div>
  );

  const Header = () => (
    <div className="bg-gray-100 border-b border-gray-300 px-6 py-3 flex items-center justify-between">
      <h1 className="text-xl font-semibold">ATBulSU Schedule</h1>
      <div className="flex items-center gap-4">
        <div className="text-gray-600 cursor-pointer"><SearchIcon /></div>
        <div className="text-gray-600 cursor-pointer"><BellIcon /></div>
        <div className="text-gray-600 cursor-pointer"><UserIcon /></div>
        <div className="text-gray-600 cursor-pointer"><MenuIcon /></div>
      </div>
    </div>
  );

  const CampusesView = () => (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-6 text-center">CAMPUSES</h2>
      <div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto">
        {campuses.map((campus) => (
          <button
            key={campus.id}
            onClick={() => handleCampusSelect(campus)}
            className="bg-gray-300 hover:bg-gray-400 p-8 text-xl font-bold transition-colors"
          >
            {campus.name}
          </button>
        ))}
      </div>
      <div className="mt-8 text-center space-y-2">
        <div className="space-x-2">
          <button className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-sm">choose file</button>
          <span className="text-sm">dataset.csv</span>
        </div>
        <div className="space-x-2">
          <button className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-sm">Generate schedule</button>
          <button className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-sm">export schedule</button>
        </div>
      </div>
    </div>
  );

  const BuildingsView = () => (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-2 text-center">BUILDINGS</h2>
      <p className="text-center text-gray-600 mb-6">{selectedCampus?.name}</p>
      <div className="grid grid-cols-4 gap-4 max-w-4xl mx-auto">
        {selectedCampus && buildings[selectedCampus.id]?.map((building) => (
          <button
            key={building.id}
            onClick={() => handleBuildingSelect(building)}
            className="bg-gray-300 hover:bg-gray-400 p-8 text-lg font-semibold transition-colors"
          >
            {building.name}
          </button>
        ))}
      </div>
      <div className="mt-8 text-center">
        <button onClick={handleBack} className="px-6 py-2 bg-gray-300 hover:bg-gray-400 font-semibold">
          BACK
        </button>
      </div>
    </div>
  );

  const RoomsView = () => (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-2 text-center">ROOMS</h2>
      <p className="text-center text-gray-600 mb-1">{selectedCampus?.name}</p>
      <p className="text-center text-gray-600 mb-6">{selectedBuilding?.name}</p>
      <div className="grid grid-cols-5 gap-4 max-w-4xl mx-auto">
        {selectedBuilding && rooms[selectedBuilding.id]?.map((room) => (
          <button
            key={room.id}
            onClick={() => handleRoomSelect(room)}
            className="bg-gray-300 hover:bg-gray-400 p-6 transition-colors"
          >
            <div className="text-2xl font-bold mb-1">{room.id}</div>
            <div className="text-sm text-gray-600">{room.capacity}</div>
          </button>
        ))}
      </div>
      <div className="mt-8 text-center">
        <button onClick={handleBack} className="px-6 py-2 bg-gray-300 hover:bg-gray-400 font-semibold">
          BACK
        </button>
      </div>
    </div>
  );

  const ApplicantsView = () => (
    <div className="p-8">
      <div className="text-xs text-gray-500 mb-2">ADMIN HOME UI</div>
      <h2 className="text-2xl font-bold mb-2 text-center">APPLICANTS LIST</h2>
      <p className="text-center text-gray-600 mb-1">{selectedCampus?.name}</p>
      <p className="text-center text-gray-600 mb-6">{selectedBuilding?.name}-{selectedRoom?.id}</p>
      
      <div className="max-w-5xl mx-auto bg-white border border-gray-300">
        <table className="w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-semibold">application no.</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">course</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">major</th>
              <th className="px-4 py-2 text-left text-sm font-semibold">time</th>
            </tr>
          </thead>
          <tbody>
            {applicants.map((applicant, index) => (
              <tr key={index} className="border-t border-gray-300">
                <td className="px-4 py-2 text-sm">{applicant.appNo}</td>
                <td className="px-4 py-2 text-sm">{applicant.course}</td>
                <td className="px-4 py-2 text-sm">{applicant.major}</td>
                <td className="px-4 py-2 text-sm">{applicant.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-center space-x-4">
        <button onClick={handleBack} className="px-6 py-2 bg-gray-300 hover:bg-gray-400 font-semibold">
          BACK
        </button>
        <button className="px-6 py-2 bg-gray-300 hover:bg-gray-400 font-semibold">
          export
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-y-auto">
          {currentView === 'campuses' && <CampusesView />}
          {currentView === 'buildings' && <BuildingsView />}
          {currentView === 'rooms' && <RoomsView />}
          {currentView === 'applicants' && <ApplicantsView />}
        </div>
      </div>
    </div>
  );
};

export default ATBulSUSchedule;