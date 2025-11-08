'use client'

import React from 'react'
import './loading.css'

interface LoadingScreenProps {
  message?: string
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading Quantum Qtime...' }) => {
  return (
    <div className="loading-screen">
      {/* Animated Background */}
      <div className="loading-background">
        <div className="quantum-logo"></div>
        <div className="stars"></div>
        <div className="glow-effect"></div>
        <div className="particle-field">
          {Array.from({ length: 50 }, (_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Central Loading Animation */}
      <div className="loading-center">
        <div className="quantum-loader">
          <div className="loader-ring"></div>
          <div className="loader-core">
            <div className="core-pulse"></div>
            <div className="core-spark"></div>
          </div>
          <div className="orbiting-dots">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="orbit-dot"
                style={{ transform: `rotate(${i * 60}deg) translateX(60px)` }}
              ></div>
            ))}
          </div>
        </div>
        <h2 className="loading-text">{message}</h2>
      </div>
    </div>
  )
}

export default LoadingScreen