// Cargo Digital Twin Types

export interface Package {
  id: string;
  name: string;
  dimensions: { length: number; width: number; height: number };
  weight: number;
  fragile: boolean;
  temperature: number;
  position?: { x: number; y: number; z: number };
  color?: string;
}

export interface ULDContainer {
  id: string;
  name: string;
  type: string;
  dimensions: { length: number; width: number; height: number };
  maxWeight: number;
  currentWeight: number;
  packages: Package[]; // Make this always defined (not optional)
  status: 'in-progress' | 'completed' | 'loaded';
  position?: { x: number; y: number; z: number }; // Position in aircraft hold
  utilization: number; // Percentage
  stability: number; // Score 0-100
}

export interface AircraftHold {
  id: string;
  name: string;
  dimensions: { length: number; width: number; height: number };
  maxWeight: number;
  currentWeight: number;
  ulds: ULDContainer[];
  zones: Zone[];
}

export interface Zone {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  dimensions: { length: number; width: number; height: number };
  priority: number;
  restrictions: string[];
}

export interface SensorData {
  temperature: number;
  weight: number;
  centerOfGravity: { x: number; y: number; z: number };
  stability: number;
}

export type Strategy = 'balanced' | 'maxWeight' | 'maxSpace' | 'fragile' | 'safety' | 'cost' | 'time';

export interface OptimizationResult {
  packages?: Package[];
  ulds?: ULDContainer[];
  centerOfGravity: { x: number; y: number; z: number };
  stability: number;
  warnings: string[];
  suggestions: string[];
}

// ULD Container Type Presets
export const ULD_TYPES = {
  AKE: { 
    name: 'AKE Container',
    dimensions: { length: 3.6, width: 3.0, height: 2.5 },
    maxWeight: 3500,
    description: 'Standard LD3 container for wide-body aircraft'
  },
  AKN: { 
    name: 'AKN Container',
    dimensions: { length: 2.4, width: 1.5, height: 1.6 },
    maxWeight: 1588,
    description: 'Half-size container for lower deck'
  },
  AKH: { 
    name: 'AKH Container',
    dimensions: { length: 3.2, width: 2.4, height: 2.1 },
    maxWeight: 3176,
    description: 'High-capacity container'
  },
  CUSTOM: {
    name: 'Custom Container',
    dimensions: { length: 2.0, width: 2.0, height: 2.0 },
    maxWeight: 2000,
    description: 'User-defined dimensions'
  }
};

// Aircraft Hold Configuration
export const AIRCRAFT_HOLDS = {
  B777F: {
    name: 'Boeing 777F Main Deck',
    dimensions: { length: 32.0, width: 3.0, height: 2.8 },
    maxWeight: 103000,
    maxULDs: 28
  },
  B747F: {
    name: 'Boeing 747-8F Main Deck',
    dimensions: { length: 42.0, width: 3.2, height: 3.0 },
    maxWeight: 140000,
    maxULDs: 36
  },
  A330F: {
    name: 'Airbus A330-200F Main Deck',
    dimensions: { length: 28.0, width: 2.8, height: 2.6 },
    maxWeight: 65000,
    maxULDs: 23
  }
};

// Safety and optimization conditions
export const OPTIMIZATION_CONDITIONS = {
  MAX_STACK_HEIGHT: 3, // Maximum ULDs stacked
  MIN_STABILITY_SCORE: 70,
  MAX_COG_DEVIATION: 2.0, // meters from center
  FRAGILE_TOP_ONLY: true,
  HEAVY_BOTTOM_PRIORITY: true,
  TEMPERATURE_SEPARATION: 10, // degrees C difference requires separation
  MIN_SUPPORT_RATIO: 0.7 // 70% support required
};