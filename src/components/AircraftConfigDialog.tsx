import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { AircraftConfig, AIRCRAFT_TYPES } from '../types/aircraft';
import { Plane, Settings } from 'lucide-react';

interface AircraftConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigureAircraft: (config: AircraftConfig) => void;
  currentConfig: AircraftConfig;
}

export function AircraftConfigDialog({ 
  open, 
  onOpenChange, 
  onConfigureAircraft,
  currentConfig 
}: AircraftConfigDialogProps) {
  const [selectedModel, setSelectedModel] = useState<string>(currentConfig.model);
  const [customConfig, setCustomConfig] = useState<AircraftConfig>(currentConfig);
  const [isCustom, setIsCustom] = useState(currentConfig.model === 'CUSTOM');

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    if (model === 'CUSTOM') {
      setIsCustom(true);
      setCustomConfig(AIRCRAFT_TYPES['CUSTOM']);
    } else {
      setIsCustom(false);
      setCustomConfig(AIRCRAFT_TYPES[model]);
    }
  };

  const handleApply = () => {
    onConfigureAircraft(isCustom ? customConfig : AIRCRAFT_TYPES[selectedModel]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f172b] border-[rgba(0,93,99,0.3)] text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Plane className="size-6 text-[#005D63]" />
            Configure Aircraft
          </DialogTitle>
          <DialogDescription className="text-[#bedbff]">
            Select an aircraft type or create a custom configuration
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Aircraft Type Selection */}
          <div>
            <Label className="text-[#005D63] text-sm mb-3 block">SELECT AIRCRAFT MODEL</Label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(AIRCRAFT_TYPES).map(([key, aircraft]) => (
                <button
                  key={key}
                  onClick={() => handleModelSelect(key)}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${
                    selectedModel === key
                      ? 'border-[#005D63] bg-[rgba(0,93,99,0.2)]'
                      : 'border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.05)] hover:border-[rgba(0,93,99,0.5)]'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-white font-bold">{aircraft.model}</div>
                      <div className="text-[#bedbff] text-xs">{aircraft.manufacturer}</div>
                    </div>
                    {selectedModel === key && (
                      <div className="size-5 rounded-full bg-[#005D63] flex items-center justify-center">
                        <div className="text-white text-xs">✓</div>
                      </div>
                    )}
                  </div>
                  <div className="text-[#bedbff] text-xs space-y-1">
                    <div>📦 {aircraft.holdDimensions.length}×{aircraft.holdDimensions.width}×{aircraft.holdDimensions.height}m</div>
                    <div>⚖️ {(aircraft.maxPayloadWeight / 1000).toFixed(0)}t payload</div>
                    <div>📊 {aircraft.maxULDCount} ULDs max</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Aircraft Details */}
          {!isCustom && (
            <div className="bg-[rgba(0,93,99,0.1)] border border-[rgba(0,93,99,0.3)] rounded-lg p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-12 rounded-full bg-[#005D63] flex items-center justify-center">
                  <Plane className="size-6 text-white" />
                </div>
                <div>
                  <div className="text-white font-bold text-lg">{AIRCRAFT_TYPES[selectedModel].name}</div>
                  <div className="text-[#bedbff] text-sm">{AIRCRAFT_TYPES[selectedModel].description}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-3">
                  <div className="text-[#005D63] text-xs mb-1">CARGO HOLD</div>
                  <div className="text-white font-bold">
                    {AIRCRAFT_TYPES[selectedModel].holdDimensions.length}×
                    {AIRCRAFT_TYPES[selectedModel].holdDimensions.width}×
                    {AIRCRAFT_TYPES[selectedModel].holdDimensions.height}m
                  </div>
                  <div className="text-[#bedbff] text-xs mt-1">
                    {AIRCRAFT_TYPES[selectedModel].maxCargoVolume}m³
                  </div>
                </div>

                <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-3">
                  <div className="text-[#005D63] text-xs mb-1">MAX PAYLOAD</div>
                  <div className="text-white font-bold">
                    {(AIRCRAFT_TYPES[selectedModel].maxPayloadWeight / 1000).toFixed(1)}t
                  </div>
                  <div className="text-[#bedbff] text-xs mt-1">
                    {AIRCRAFT_TYPES[selectedModel].maxPayloadWeight.toLocaleString()}kg
                  </div>
                </div>
                <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-3">
                  <div className="text-[#005D63] text-xs mb-1">ULD CAPACITY</div>
                  <div className="text-white font-bold">
                    {AIRCRAFT_TYPES[selectedModel].maxULDCount} ULDs
                  </div>
                  <div className="text-[#bedbff] text-xs mt-1">Maximum</div>
                </div>

                <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-3">
                  <div className="text-[#005D63] text-xs mb-1">RANGE</div>
                  <div className="text-white font-bold">
                    {AIRCRAFT_TYPES[selectedModel].range.toLocaleString()}km
                  </div>
                  <div className="text-[#bedbff] text-xs mt-1">Maximum</div>
                </div>

                <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-3">
                  <div className="text-[#005D63] text-xs mb-1">CRUISE SPEED</div>
                  <div className="text-white font-bold">
                    {AIRCRAFT_TYPES[selectedModel].cruiseSpeed}km/h
                  </div>
                  <div className="text-[#bedbff] text-xs mt-1">Typical</div>
                </div>

                <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-3">
                  <div className="text-[#005D63] text-xs mb-1">MANUFACTURER</div>
                  <div className="text-white font-bold">
                    {AIRCRAFT_TYPES[selectedModel].manufacturer}
                  </div>
                  <div className="text-[#bedbff] text-xs mt-1">{AIRCRAFT_TYPES[selectedModel].model}</div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Configuration */}
          {isCustom && (
            <div className="bg-[rgba(0,93,99,0.1)] border border-[rgba(0,93,99,0.3)] rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="size-5 text-[#005D63]" />
                <Label className="text-[#005D63]">CUSTOM AIRCRAFT CONFIGURATION</Label>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[#bedbff] text-sm">Aircraft Name</Label>
                    <Input
                      value={customConfig.name}
                      onChange={(e) => setCustomConfig({...customConfig, name: e.target.value})}
                      className="bg-[rgba(255,255,255,0.1)] border-[rgba(0,93,99,0.4)] text-white mt-1"
                      placeholder="Custom Freighter"
                    />
                  </div>
                  <div>
                    <Label className="text-[#bedbff] text-sm">Model Code</Label>
                    <Input
                      value={customConfig.model}
                      onChange={(e) => setCustomConfig({...customConfig, model: e.target.value})}
                      className="bg-[rgba(255,255,255,0.1)] border-[rgba(0,93,99,0.4)] text-white mt-1"
                      placeholder="CUSTOM-001"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[#005D63] text-sm mb-2 block">CARGO HOLD DIMENSIONS</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[#bedbff] text-xs">Length (m)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={customConfig.holdDimensions.length}
                        onChange={(e) => setCustomConfig({
                          ...customConfig,
                          holdDimensions: {...customConfig.holdDimensions, length: parseFloat(e.target.value)}
                        })}
                        className="bg-[rgba(255,255,255,0.1)] border-[rgba(0,93,99,0.4)] text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[#bedbff] text-xs">Width (m)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={customConfig.holdDimensions.width}
                        onChange={(e) => setCustomConfig({
                          ...customConfig,
                          holdDimensions: {...customConfig.holdDimensions, width: parseFloat(e.target.value)}
                        })}
                        className="bg-[rgba(255,255,255,0.1)] border-[rgba(0,93,99,0.4)] text-white mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[#bedbff] text-xs">Height (m)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={customConfig.holdDimensions.height}
                        onChange={(e) => setCustomConfig({
                          ...customConfig,
                          holdDimensions: {...customConfig.holdDimensions, height: parseFloat(e.target.value)}
                        })}
                        className="bg-[rgba(255,255,255,0.1)] border-[rgba(0,93,99,0.4)] text-white mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[#bedbff] text-sm">Max Payload Weight (kg)</Label>
                    <Input
                      type="number"
                      step="1000"
                      value={customConfig.maxPayloadWeight}
                      onChange={(e) => setCustomConfig({...customConfig, maxPayloadWeight: parseFloat(e.target.value)})}
                      className="bg-[rgba(255,255,255,0.1)] border-[rgba(0,93,99,0.4)] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[#bedbff] text-sm">Max ULD Count</Label>
                    <Input
                      type="number"
                      value={customConfig.maxULDCount}
                      onChange={(e) => setCustomConfig({...customConfig, maxULDCount: parseInt(e.target.value)})}
                      className="bg-[rgba(255,255,255,0.1)] border-[rgba(0,93,99,0.4)] text-white mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-[#bedbff] text-sm">Range (km)</Label>
                    <Input
                      type="number"
                      step="100"
                      value={customConfig.range}
                      onChange={(e) => setCustomConfig({...customConfig, range: parseFloat(e.target.value)})}
                      className="bg-[rgba(255,255,255,0.1)] border-[rgba(0,93,99,0.4)] text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[#bedbff] text-sm">Cruise Speed (km/h)</Label>
                    <Input
                      type="number"
                      step="10"
                      value={customConfig.cruiseSpeed}
                      onChange={(e) => setCustomConfig({...customConfig, cruiseSpeed: parseFloat(e.target.value)})}
                      className="bg-[rgba(255,255,255,0.1)] border-[rgba(0,93,99,0.4)] text-white mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="flex-1 border-[rgba(255,255,255,0.3)] text-white hover:bg-[rgba(255,255,255,0.1)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              className="flex-1 bg-gradient-to-r from-[#005D63] to-[#004852] hover:opacity-90"
            >
              Apply Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
