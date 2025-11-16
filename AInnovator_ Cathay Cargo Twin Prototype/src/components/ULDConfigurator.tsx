import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ULD_TYPES } from '../types/cargo';
import { toast } from "sonner@2.0.3";

interface ULDConfiguratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateULD: (config: {
    name: string;
    type: string;
    dimensions: { length: number; width: number; height: number };
    maxWeight: number;
  }) => void;
}

export function ULDConfigurator({ open, onOpenChange, onCreateULD }: ULDConfiguratorProps) {
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<keyof typeof ULD_TYPES>('AKE');
  const [length, setLength] = useState(ULD_TYPES.AKE.dimensions.length.toString());
  const [width, setWidth] = useState(ULD_TYPES.AKE.dimensions.width.toString());
  const [height, setHeight] = useState(ULD_TYPES.AKE.dimensions.height.toString());
  const [maxWeight, setMaxWeight] = useState(ULD_TYPES.AKE.maxWeight.toString());

  const handleTypeChange = (type: string) => {
    const uldType = type as keyof typeof ULD_TYPES;
    setSelectedType(uldType);
    const preset = ULD_TYPES[uldType];
    setLength(preset.dimensions.length.toString());
    setWidth(preset.dimensions.width.toString());
    setHeight(preset.dimensions.height.toString());
    setMaxWeight(preset.maxWeight.toString());
  };

  const handleSubmit = () => {
    if (!name) {
      toast.error('Please enter a ULD name');
      return;
    }

    const lengthNum = parseFloat(length);
    const widthNum = parseFloat(width);
    const heightNum = parseFloat(height);
    const maxWeightNum = parseFloat(maxWeight);

    if (lengthNum <= 0 || widthNum <= 0 || heightNum <= 0 || maxWeightNum <= 0) {
      toast.error('All dimensions and weight must be positive numbers');
      return;
    }

    onCreateULD({
      name,
      type: ULD_TYPES[selectedType].name,
      dimensions: {
        length: lengthNum,
        width: widthNum,
        height: heightNum
      },
      maxWeight: maxWeightNum
    });

    // Reset form
    setName('');
    setSelectedType('AKE');
    handleTypeChange('AKE');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f172b] border-[rgba(255,255,255,0.2)] text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">Configure ULD Container</DialogTitle>
          <DialogDescription className="text-[#bedbff] text-sm">Enter the details for the ULD container you want to create.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pb-4">
          <div>
            <Label htmlFor="uld-name" className="text-[#bedbff]">ULD Name/ID</Label>
            <Input
              id="uld-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., ULD-001"
              className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white"
            />
          </div>

          <div>
            <Label htmlFor="uld-type" className="text-[#bedbff]">Container Type</Label>
            <Select value={selectedType} onValueChange={handleTypeChange}>
              <SelectTrigger className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ULD_TYPES).map(([key, type]) => (
                  <SelectItem key={key} value={key}>
                    {type.name} - {type.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="uld-length" className="text-[#bedbff]">Length (m)</Label>
              <Input
                id="uld-length"
                type="number"
                step="0.1"
                min="0.1"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white"
              />
            </div>
            <div>
              <Label htmlFor="uld-width" className="text-[#bedbff]">Width (m)</Label>
              <Input
                id="uld-width"
                type="number"
                step="0.1"
                min="0.1"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white"
              />
            </div>
            <div>
              <Label htmlFor="uld-height" className="text-[#bedbff]">Height (m)</Label>
              <Input
                id="uld-height"
                type="number"
                step="0.1"
                min="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="uld-weight" className="text-[#bedbff]">Maximum Weight (kg)</Label>
            <Input
              id="uld-weight"
              type="number"
              step="10"
              min="100"
              value={maxWeight}
              onChange={(e) => setMaxWeight(e.target.value)}
              className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white"
            />
          </div>

          {/* Space Allocation Information */}
          <div className="bg-[rgba(0,93,99,0.2)] border border-[rgba(0,93,99,0.4)] rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[#00CED1] font-bold text-sm">📐 Space Allocation Details</div>
            </div>
            
            {/* Outer Dimensions */}
            <div>
              <div className="text-[#bedbff] text-xs font-bold mb-1">Outer Container Dimensions</div>
              <div className="bg-[rgba(0,0,0,0.3)] rounded p-2 text-white text-xs">
                {length} m (L) × {width} m (W) × {height} m (H)
              </div>
            </div>
            
            {/* Safety Margin */}
            <div>
              <div className="text-[#bedbff] text-xs font-bold mb-1">Safety Margin (Wall Clearance)</div>
              <div className="bg-[rgba(0,0,0,0.3)] rounded p-2 text-yellow-300 text-xs">
                0.02 m (2 cm) on each side for safety
              </div>
            </div>
            
            {/* Allocatable Space */}
            <div>
              <div className="text-[#00CED1] text-xs font-bold mb-1">✓ Actual Allocatable Space</div>
              <div className="bg-[rgba(34,197,94,0.2)] border border-green-500/40 rounded p-2 space-y-1">
                <div className="text-green-400 text-xs font-bold">
                  {(parseFloat(length) - 0.04).toFixed(2)} m (L) × {(parseFloat(width) - 0.04).toFixed(2)} m (W) × {height} m (H)
                </div>
                <div className="text-white/60 text-[10px]">
                  Length: {length}m - 0.04m = {(parseFloat(length) - 0.04).toFixed(2)}m<br/>
                  Width: {width}m - 0.04m = {(parseFloat(width) - 0.04).toFixed(2)}m<br/>
                  Height: {height}m (full height available)
                </div>
              </div>
            </div>
            
            {/* Volume Comparison */}
            <div>
              <div className="text-[#bedbff] text-xs font-bold mb-1">Volume Utilization</div>
              <div className="bg-[rgba(0,0,0,0.3)] rounded p-2 text-xs space-y-1">
                <div className="flex justify-between text-white/80">
                  <span>Outer Volume:</span>
                  <span>{(parseFloat(length) * parseFloat(width) * parseFloat(height)).toFixed(2)} m³</span>
                </div>
                <div className="flex justify-between text-green-400">
                  <span>Usable Volume:</span>
                  <span>{((parseFloat(length) - 0.04) * (parseFloat(width) - 0.04) * parseFloat(height)).toFixed(2)} m³</span>
                </div>
                <div className="flex justify-between text-yellow-300">
                  <span>Lost to Margins:</span>
                  <span>
                    {(
                      (parseFloat(length) * parseFloat(width) * parseFloat(height)) - 
                      ((parseFloat(length) - 0.04) * (parseFloat(width) - 0.04) * parseFloat(height))
                    ).toFixed(3)} m³ ({(
                      (1 - ((parseFloat(length) - 0.04) * (parseFloat(width) - 0.04) * parseFloat(height)) / 
                      (parseFloat(length) * parseFloat(width) * parseFloat(height))) * 100
                    ).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
            
            <div className="text-[10px] text-white/60 italic pt-2 border-t border-white/10">
              ℹ️ Safety margins prevent packages from touching container walls, ensuring structural integrity and preventing damage during transport.
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            className="w-full bg-gradient-to-r from-[#2b7fff] to-[#00b8db] hover:opacity-90"
          >
            Create ULD Container
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}