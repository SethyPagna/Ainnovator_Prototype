import React from 'react';
import containerImage from 'figma:asset/4497a908ec1b26307abef533301104d49fdc2bc4.png';
import cargoHoldImage from 'figma:asset/c02f9bff31ceb588865899aaa71e2f7fcf4e0bfa.png';

interface Package {
  id: string;
  name: string;
  dimensions: { length: number; width: number; height: number };
  weight: number;
  fragile: boolean;
  temperature: number;
  position?: { x: number; y: number; z: number };
}

interface ContainerType {
  id: string;
  name: string;
  dimensions: { length: number; width: number; height: number };
  maxWeight: number;
}

interface RealisticCargoViewProps {
  packages: Package[];
  containerType: ContainerType;
  viewMode: 'container' | 'aircraft';
}

export function RealisticCargoView({ packages, containerType, viewMode }: RealisticCargoViewProps) {
  return (
    <div className="relative w-full h-full overflow-hidden rounded-[16px]">
      {/* Background based on view mode */}
      {viewMode === 'container' ? (
        <div className="absolute inset-0">
          <img 
            src={containerImage} 
            alt="ULD Container" 
            className="absolute inset-0 w-full h-full object-contain opacity-30"
            style={{ 
              filter: 'brightness(0.8) contrast(1.2)',
              mixBlendMode: 'screen'
            }}
          />
          {/* Overlay grid pattern */}
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px),
                linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px'
            }}
          />
        </div>
      ) : (
        <div className="absolute inset-0">
          <img 
            src={cargoHoldImage} 
            alt="Aircraft Cargo Hold" 
            className="absolute inset-0 w-full h-full object-cover opacity-20"
            style={{ 
              filter: 'brightness(0.6) contrast(1.3)',
            }}
          />
        </div>
      )}

      {/* Package visualization overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative" style={{ 
          width: '400px', 
          height: '400px',
          perspective: '1000px'
        }}>
          {packages.map((pkg, index) => {
            if (!pkg.position) return null;

            // Calculate 2D position based on 3D coordinates
            const scale = 80;
            const offsetX = (pkg.position.x / containerType.dimensions.length) * 300;
            const offsetY = (pkg.position.z / containerType.dimensions.height) * 300;
            const depth = (pkg.position.y / containerType.dimensions.width) * 100;

            return (
              <div
                key={pkg.id}
                className="absolute transition-all duration-500"
                style={{
                  left: `${50 + offsetX - depth * 0.3}%`,
                  top: `${80 - offsetY}%`,
                  transform: `translate(-50%, -50%) scale(${1 - depth * 0.005})`,
                  zIndex: Math.floor(1000 - depth)
                }}
              >
                {/* Package representation */}
                <div 
                  className={`
                    relative rounded-lg shadow-2xl border-2
                    ${pkg.fragile ? 'border-[#FDC700] bg-[#f59e0b]' : 'border-[#3b82f6] bg-[#2563eb]'}
                    transition-all duration-300 hover:scale-110
                  `}
                  style={{
                    width: `${pkg.dimensions.length * 40}px`,
                    height: `${pkg.dimensions.height * 40}px`,
                    opacity: 0.9,
                  }}
                >
                  {/* Package details */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-white text-center">
                    <div className="text-[10px] font-bold truncate w-full">{pkg.name}</div>
                    <div className="text-[8px] opacity-75">{pkg.weight}kg</div>
                    {pkg.fragile && (
                      <div className="text-[10px] mt-1">⚠</div>
                    )}
                  </div>

                  {/* 3D effect edges */}
                  <div 
                    className="absolute inset-0 border-l-2 border-t-2 border-white opacity-40 rounded-lg"
                    style={{ transform: 'translate(-2px, -2px)' }}
                  />
                  <div 
                    className="absolute inset-0 border-r-2 border-b-2 border-black opacity-20 rounded-lg"
                    style={{ transform: 'translate(2px, 2px)' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Container outline */}
      {viewMode === 'container' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div 
            className="border-4 border-dashed border-blue-400 opacity-30 rounded-lg"
            style={{
              width: '500px',
              height: '400px',
              boxShadow: 'inset 0 0 50px rgba(59, 130, 246, 0.3)'
            }}
          />
        </div>
      )}

      {/* Measurement guides */}
      <div className="absolute bottom-4 left-4 text-white text-[10px] font-mono opacity-75 space-y-1">
        <div>Length: {containerType.dimensions.length}m</div>
        <div>Width: {containerType.dimensions.width}m</div>
        <div>Height: {containerType.dimensions.height}m</div>
      </div>

      {/* View mode indicator */}
      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-white text-[10px]">
        {viewMode === 'container' ? 'ULD Container View' : 'Aircraft Hold View'}
      </div>
    </div>
  );
}
