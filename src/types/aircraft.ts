// Aircraft configuration types and presets

export interface AircraftConfig {
  name: string;
  model: string;
  manufacturer: string;
  holdDimensions: {
    length: number;
    width: number;
    height: number;
  };
  maxPayloadWeight: number; // kg
  maxCargoVolume: number; // cubic meters
  maxULDCount: number;
  range: number; // km
  cruiseSpeed: number; // km/h
  description: string;
}

export const AIRCRAFT_TYPES: Record<string, AircraftConfig> = {
  'B747-8F': {
    name: 'Boeing 747-8 Freighter',
    model: 'B747-8F',
    manufacturer: 'Boeing',
    holdDimensions: {
      length: 43.9,
      width: 6.1,
      height: 3.0
    },
    maxPayloadWeight: 134000,
    maxCargoVolume: 858,
    maxULDCount: 39,
    range: 8130,
    cruiseSpeed: 908,
    description: 'World\'s largest twin-engine freighter with exceptional range'
  },
  'B777F': {
    name: 'Boeing 777 Freighter',
    model: 'B777F',
    manufacturer: 'Boeing',
    holdDimensions: {
      length: 32.0,
      width: 5.87,
      height: 3.2
    },
    maxPayloadWeight: 102000,
    maxCargoVolume: 653,
    maxULDCount: 27,
    range: 9070,
    cruiseSpeed: 896,
    description: 'Long-range, high-capacity freighter for intercontinental routes'
  },
  'B767-300F': {
    name: 'Boeing 767-300 Freighter',
    model: 'B767-300F',
    manufacturer: 'Boeing',
    holdDimensions: {
      length: 26.5,
      width: 4.72,
      height: 2.87
    },
    maxPayloadWeight: 54900,
    maxCargoVolume: 438,
    maxULDCount: 24,
    range: 6025,
    cruiseSpeed: 851,
    description: 'Medium-range freighter ideal for regional operations'
  },
  'A330-200F': {
    name: 'Airbus A330-200F',
    model: 'A330-200F',
    manufacturer: 'Airbus',
    holdDimensions: {
      length: 30.4,
      width: 5.64,
      height: 3.17
    },
    maxPayloadWeight: 70000,
    maxCargoVolume: 475,
    maxULDCount: 23,
    range: 7400,
    cruiseSpeed: 871,
    description: 'Versatile wide-body freighter with excellent efficiency'
  },
  'A350F': {
    name: 'Airbus A350 Freighter',
    model: 'A350F',
    manufacturer: 'Airbus',
    holdDimensions: {
      length: 38.8,
      width: 5.96,
      height: 3.1
    },
    maxPayloadWeight: 109000,
    maxCargoVolume: 693,
    maxULDCount: 28,
    range: 8700,
    cruiseSpeed: 910,
    description: 'Next-generation freighter with advanced technology'
  },
  'MD-11F': {
    name: 'McDonnell Douglas MD-11F',
    model: 'MD-11F',
    manufacturer: 'McDonnell Douglas',
    holdDimensions: {
      length: 28.6,
      width: 5.49,
      height: 2.95
    },
    maxPayloadWeight: 90700,
    maxCargoVolume: 497,
    maxULDCount: 26,
    range: 7240,
    cruiseSpeed: 876,
    description: 'Tri-jet freighter known for reliability and cargo capacity'
  },
  'B737-800BCF': {
    name: 'Boeing 737-800BCF',
    model: 'B737-800BCF',
    manufacturer: 'Boeing',
    holdDimensions: {
      length: 18.3,
      width: 3.54,
      height: 1.73
    },
    maxPayloadWeight: 23400,
    maxCargoVolume: 151,
    maxULDCount: 12,
    range: 3700,
    cruiseSpeed: 850,
    description: 'Narrow-body converted freighter for short to medium routes'
  },
  'CUSTOM': {
    name: 'Custom Aircraft',
    model: 'CUSTOM',
    manufacturer: 'Custom',
    holdDimensions: {
      length: 30.0,
      width: 6.0,
      height: 3.0
    },
    maxPayloadWeight: 80000,
    maxCargoVolume: 540,
    maxULDCount: 25,
    range: 7000,
    cruiseSpeed: 880,
    description: 'Customizable aircraft configuration'
  }
};

export function getAircraftByModel(model: string): AircraftConfig {
  return AIRCRAFT_TYPES[model] || AIRCRAFT_TYPES['B777F'];
}

export function calculateHoldVolume(dimensions: { length: number; width: number; height: number }): number {
  return dimensions.length * dimensions.width * dimensions.height;
}
