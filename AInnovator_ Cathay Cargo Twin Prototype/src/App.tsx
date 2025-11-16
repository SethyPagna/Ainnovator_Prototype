import React, { useState, useEffect } from 'react';
import { Package, ULDContainer, SensorData, Strategy } from './types/cargo';
import { AircraftConfig, AIRCRAFT_TYPES } from './types/aircraft';
import { CargoVisualization3D } from './components/CargoVisualization3D';
import { AircraftHoldView3D } from './components/AircraftHoldView3D';
import { AircraftConfigDialog } from './components/AircraftConfigDialog';
import { ULDConfigurator } from './components/ULDConfigurator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './components/ui/dialog';
import { Button } from './components/ui/button';
import { Label } from './components/ui/label';
import { Input } from './components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { optimizePackagePacking } from './utils/packingAlgorithm';
import { optimizeULDPlacement } from './utils/uldOptimization';
import { toast } from 'sonner@2.0.3';
import { AlertCircle, Plane, Package as PackageIcon } from 'lucide-react';

const strategyLabels: Record<Strategy, string> = {
  balanced: 'Balanced',
  maxWeight: 'Max Weight',
  maxSpace: 'Max Space',
  fragile: 'Fragile Priority',
  safety: 'Safety First',
  cost: 'Cost Optimized',
  time: 'Time Critical'
};

// Figma Design Components
function Container3() {
  return (
    <div className="absolute h-[663px] left-0 opacity-20 top-0 w-[1277px]">
      <div className="absolute bg-[#005D63] blur-3xl filter left-[319.25px] opacity-[0.613] rounded-[1.67772e+07px] size-[384px] top-0" />
      <div className="absolute bg-[#006B71] blur-3xl filter left-[573.75px] opacity-[0.887] rounded-[1.67772e+07px] size-[384px] top-[331.5px]" />
      <div className="absolute bg-[#005D63] blur-3xl filter left-[638.5px] opacity-[0.613] rounded-[1.67772e+07px] size-[384px] top-[279px]" />
    </div>
  );
}

function Header({ strategy, setStrategy, activeTab, setActiveTab }: {
  strategy: Strategy;
  setStrategy: (strategy: Strategy) => void;
  activeTab: 'packing' | 'aircraft';
  setActiveTab: (tab: 'packing' | 'aircraft') => void;
}) {
  return (
    <div className="bg-[#005D63] h-[107px] relative shrink-0">
      <div aria-hidden="true" className="absolute border-[0px_0px_1px] border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col h-[107px] items-start pb-px pt-[24px] px-[32px] relative">
        <div className="content-stretch flex h-[58px] items-center justify-between relative shrink-0 w-full">
          <div className="flex items-center gap-4">
            <div className="relative rounded-[16px] bg-white/90 shadow-[0px_10px_15px_-3px_rgba(0,93,99,0.5)] size-[56px]">
              <div className="flex items-center justify-center size-full">
                <PackageIcon className="size-8 text-[#005D63]" />
              </div>
            </div>
            <div>
              <p className="text-[24px] text-white"> Cathay Cargo Digital Twin</p>
              <p className="text-[14px] text-[#bedbff]">AI-Powered 3D Cargo Optimization System</p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <Select value={strategy} onValueChange={(value) => setStrategy(value as Strategy)}>
              <SelectTrigger className="w-[200px] bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white">
                <div className="flex items-center gap-2">
                  <span className="text-[#bedbff] text-[14px]">Strategy:</span>
                  <span className="text-white">{strategyLabels[strategy]}</span>
                </div>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(strategyLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 bg-[rgba(255,255,255,0.1)] rounded-[14px] p-1 border border-[rgba(255,255,255,0.2)]">
              <button
                onClick={() => setActiveTab('packing')}
                className={`px-6 py-2 rounded-lg transition-all ${
                  activeTab === 'packing'
                    ? 'bg-gradient-to-r from-[#005D63] to-[#004852] text-white shadow-lg'
                    : 'text-[#bedbff] hover:text-white'
                }`}
              >
                ULD Packing
              </button>
              <button
                onClick={() => setActiveTab('aircraft')}
                className={`px-6 py-2 rounded-lg transition-all ${
                  activeTab === 'aircraft'
                    ? 'bg-gradient-to-r from-[#005D63] to-[#004852] text-white shadow-lg'
                    : 'text-[#bedbff] hover:text-white'
                }`}
              >
                Aircraft Loading
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPackageDialog({ open, onOpenChange, onAddPackage }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddPackage: (pkg: Omit<Package, 'id' | 'position'>) => void;
}) {
  const [name, setName] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [fragile, setFragile] = useState(false);
  const [temperature, setTemperature] = useState('20');

  const handleSubmit = () => {
    if (!name || !length || !width || !height || !weight) {
      toast.error('Please fill in all fields');
      return;
    }

    onAddPackage({
      name,
      dimensions: { length: parseFloat(length), width: parseFloat(width), height: parseFloat(height) },
      weight: parseFloat(weight),
      fragile,
      temperature: parseFloat(temperature)
    });

    setName(''); setLength(''); setWidth(''); setHeight(''); setWeight(''); setFragile(false); setTemperature('20');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f172b] border-[rgba(255,255,255,0.2)] text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-white">Add New Package</DialogTitle></DialogHeader>
        <DialogDescription className="text-[#bedbff]">Enter the details of the package you want to add.</DialogDescription>
        <div className="space-y-4 pb-4">
          <div><Label className="text-[#bedbff]">Package Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Electronics Box 1" className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><Label className="text-[#bedbff]">Length (m)</Label><Input type="number" step="0.1" value={length} onChange={(e) => setLength(e.target.value)} className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white" /></div>
            <div><Label className="text-[#bedbff]">Width (m)</Label><Input type="number" step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white" /></div>
            <div><Label className="text-[#bedbff]">Height (m)</Label><Input type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white" /></div>
          </div>
          <div><Label className="text-[#bedbff]">Weight (kg)</Label><Input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white" /></div>
          <div><Label className="text-[#bedbff]">Temperature (°C)</Label><Input type="number" value={temperature} onChange={(e) => setTemperature(e.target.value)} className="bg-[rgba(255,255,255,0.1)] border-[rgba(255,255,255,0.2)] text-white" /></div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="fragile" checked={fragile} onChange={(e) => setFragile(e.target.checked)} className="w-4 h-4" />
            <Label htmlFor="fragile" className="text-[#bedbff]">Fragile Item</Label>
          </div>
          <Button onClick={handleSubmit} className="w-full bg-gradient-to-r from-[#005D63] to-[#004852]">Add Package</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'packing' | 'aircraft'>('packing');
  const [ulds, setUlds] = useState<ULDContainer[]>([]);
  const [activeULDId, setActiveULDId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [strategy, setStrategy] = useState<Strategy>('balanced');
  const [holdDimensions, setHoldDimensions] = useState({ length: 30, width: 6, height: 3 });
  const [pendingPackages, setPendingPackages] = useState<Package[]>([]); // Packages waiting for placement
  const [exceedingPackages, setExceedingPackages] = useState<Package[]>([]); // Packages exceeding all ULD dimensions
  const [uldConfigOpen, setUldConfigOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aircraftConfig, setAircraftConfig] = useState<AircraftConfig>(AIRCRAFT_TYPES['B777F']);
  const [aircraftConfigOpen, setAircraftConfigOpen] = useState(false);
  const [selectedULDForPlacement, setSelectedULDForPlacement] = useState<string | null>(null); // ULD selected for manual placement
  const [placementHistory, setPlacementHistory] = useState<Array<{ ulds: ULDContainer[]; action: string }>>([]);

  const activeULD = ulds.find(u => u.id === activeULDId);

  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: 20,
    weight: 0,
    centerOfGravity: { x: 0, y: 0, z: 0 },
    stability: 100
  });

  // Temperature simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setSensorData(prev => ({ ...prev, temperature: 20 + Math.random() * 2 - 1 }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Update sensor data when active ULD changes
  useEffect(() => {
    if (!activeULD) return;
    const totalWeight = activeULD.packages.reduce((sum, pkg) => sum + pkg.weight, 0);
    setSensorData({
      temperature: sensorData.temperature,
      weight: Math.round(totalWeight),
      centerOfGravity: { x: activeULD.dimensions.length / 2, y: activeULD.dimensions.width / 2, z: 0 },
      stability: activeULD.stability
    });
  }, [activeULD]);

  const handleCreateULD = (config: { name: string; type: string; dimensions: any; maxWeight: number }) => {
    const newULD: ULDContainer = {
      id: `uld-${Date.now()}`,
      name: config.name,
      type: config.type,
      dimensions: config.dimensions,
      maxWeight: config.maxWeight,
      currentWeight: 0,
      packages: [],
      status: 'in-progress',
      utilization: 0,
      stability: 100
    };
    setUlds(prev => [...prev, newULD]);
    setActiveULDId(newULD.id);
    toast.success(`ULD ${config.name} created`);
    
    // Try to place exceeding packages in the new ULD
    if (exceedingPackages.length > 0) {
      setTimeout(() => tryPlaceExceedingPackages(newULD), 500);
    }
  };

  // Try to place exceeding packages when a suitable ULD becomes available
  const tryPlaceExceedingPackages = (newULD?: ULDContainer) => {
    if (exceedingPackages.length === 0) {
      toast.info('No exceeding packages to place');
      return;
    }

    // If a new ULD is provided, include it in the search
    let updatedULDs = newULD ? [...ulds, newULD] : [...ulds];
    const availableULDs = updatedULDs.filter(u => u.status === 'in-progress');
    
    if (availableULDs.length === 0) {
      toast.warning('No available ULDs for exceeding packages.');
      return;
    }

    let remainingExceeding = [...exceedingPackages];
    let placedCount = 0;

    console.log(`🔍 Trying to place ${exceedingPackages.length} exceeding packages in ${availableULDs.length} ULDs`);

    for (const pkg of exceedingPackages) {
      let placed = false;

      for (const uld of availableULDs) {
        const currentULD = updatedULDs.find(u => u.id === uld.id);
        if (!currentULD) continue;
        
        // Check if package dimensions fit in this ULD
        if (
          pkg.dimensions.length <= currentULD.dimensions.length &&
          pkg.dimensions.width <= currentULD.dimensions.width &&
          pkg.dimensions.height <= currentULD.dimensions.height &&
          currentULD.currentWeight + pkg.weight <= currentULD.maxWeight
        ) {
          console.log(`✅ Package ${pkg.name} fits in ${currentULD.name} - attempting placement...`);
          
          // Package fits! Try to place it
          const testPackages = [...currentULD.packages, pkg];
          const result = optimizePackagePacking(testPackages, currentULD, strategy);

          const wasExcluded = result.excludedPackages?.some(ep => ep.id === pkg.id);
          
          if (!wasExcluded && result.packages.some(p => p.id === pkg.id)) {
            const updatedULD = {
              ...currentULD,
              packages: result.packages,
              currentWeight: currentULD.currentWeight + pkg.weight,
              utilization: ((currentULD.currentWeight + pkg.weight) / currentULD.maxWeight) * 100,
              stability: result.stability
            };
            
            updatedULDs = updatedULDs.map(u => u.id === currentULD.id ? updatedULD : u);
            remainingExceeding = remainingExceeding.filter(p => p.id !== pkg.id);
            placed = true;
            placedCount++;
            
            console.log(`✅ Successfully placed ${pkg.name} in ${currentULD.name}`);
            toast.success(`✅ ${pkg.name} placed in ${currentULD.name} (was exceeding)`, { duration: 3000 });
            break;
          } else {
            console.warn(`❌ ${pkg.name} was excluded by packing algorithm despite fitting in ${currentULD.name}`);
          }
        } else {
          console.log(`❌ Package ${pkg.name} doesn't fit in ${currentULD.name}`);
        }
      }
    }

    setUlds(updatedULDs);
    setExceedingPackages(remainingExceeding);

    if (placedCount > 0) {
      toast.success(`🎉 ${placedCount} exceeding package(s) successfully placed!`);
    } else if (exceedingPackages.length > 0) {
      toast.warning(`⚠️ Could not place ${exceedingPackages.length} exceeding package(s). They may need specific support or more space.`);
    }
  };

  const handleAddPackage = (pkg: Omit<Package, 'id' | 'position'>) => {
    if (!activeULD) {
      toast.error('Please create a ULD first');
      return;
    }

    const newPackage: Package = { ...pkg, id: `pkg-${Date.now()}-${Math.random()}` };
    
    // Check if package exceeds ALL existing ULDs
    const availableULDs = ulds.filter(u => u.status === 'in-progress');
    const fitsInAnyULD = availableULDs.some(uld => 
      pkg.dimensions.length <= uld.dimensions.length &&
      pkg.dimensions.width <= uld.dimensions.width &&
      pkg.dimensions.height <= uld.dimensions.height
    );

    if (!fitsInAnyULD) {
      // Package exceeds all existing ULDs
      setExceedingPackages(prev => [...prev, newPackage]);
      toast.error(
        `❌ Package exceeds ALL existing ULDs!\\n\\nPackage: ${pkg.dimensions.length}×${pkg.dimensions.width}×${pkg.dimensions.height}m\\n\\nMoved to "Exceeding ULDs" list. Create a larger ULD to accommodate it.`,
        { duration: 6000 }
      );
      return;
    }
    
    // Check if package fits in current active ULD
    if (
      pkg.dimensions.length > activeULD.dimensions.length ||
      pkg.dimensions.width > activeULD.dimensions.width ||
      pkg.dimensions.height > activeULD.dimensions.height
    ) {
      // Doesn't fit in active ULD, but fits in another - add to pending
      setPendingPackages(prev => [...prev, newPackage]);
      toast.warning(
        `⚠️ Package doesn't fit in ${activeULD.name}, but fits in another ULD.\\n\\nMoved to pending list for automatic placement.`,
        { duration: 4000 }
      );
      
      // Try to place in another ULD immediately
      setTimeout(() => tryRearrangePendingPackages(), 500);
      return;
    }

    // Package fits in active ULD - try to add it
    const updatedULD = {
      ...activeULD,
      packages: [...activeULD.packages, newPackage],
      currentWeight: activeULD.currentWeight + newPackage.weight,
      utilization: ((activeULD.currentWeight + newPackage.weight) / activeULD.maxWeight) * 100
    };

    setUlds(prev => prev.map(u => u.id === activeULD.id ? updatedULD : u));
    toast.success(`${pkg.name} added to ${activeULD.name}`);
    
    // Auto-optimize based on current strategy
    setTimeout(() => {
      autoOptimizeULD(updatedULD);
    }, 100);
  };

  // Auto-optimization function that runs based on strategy
  const autoOptimizeULD = (uld: ULDContainer) => {
    if (uld.packages.length === 0) return;

    const result = optimizePackagePacking(uld.packages, uld, strategy);
    
    // Handle excluded packages
    if (result.excludedPackages && result.excludedPackages.length > 0) {
      // Add excluded packages to pending list
      setPendingPackages(prev => [...prev, ...result.excludedPackages]);
      
      toast.warning(
        `${result.excludedPackages.length} package(s) moved to pending list. Will attempt to place in available ULDs.`,
        { duration: 4000 }
      );
    }
    
    const updatedULD = {
      ...uld,
      packages: result.packages || uld.packages,
      stability: result.stability
    };
    setUlds(prev => prev.map(u => u.id === uld.id ? updatedULD : u));
  };

  // Continuous rearrangement function - tries to fit pending packages into any available ULD
  const tryRearrangePendingPackages = () => {
    if (pendingPackages.length === 0) {
      toast.info('No pending packages to rearrange');
      return;
    }

    const availableULDs = ulds.filter(u => u.status === 'in-progress');
    if (availableULDs.length === 0) {
      toast.warning('No available ULDs. Create a new ULD or reopen a completed one.');
      return;
    }

    let remainingPending = [...pendingPackages];
    let placedCount = 0;
    let updatedULDs = [...ulds];

    // Try to fit each pending package into any available ULD
    for (const pkg of pendingPackages) {
      let placed = false;

      for (const uld of availableULDs) {
        // Get current state of this ULD
        const currentULD = updatedULDs.find(u => u.id === uld.id)!;
        
        // Check if package dimensions fit in ULD
        const margin = 0.02;
        if (
          pkg.dimensions.length > currentULD.dimensions.length - margin * 2 ||
          pkg.dimensions.width > currentULD.dimensions.width - margin * 2 ||
          pkg.dimensions.height > currentULD.dimensions.height
        ) {
          continue; // Package too large for this ULD
        }

        // Check if weight capacity allows
        if (currentULD.currentWeight + pkg.weight > currentULD.maxWeight) {
          continue; // Too heavy
        }
        
        // Try to add package to this ULD
        const testPackages = [...currentULD.packages, pkg];
        const result = optimizePackagePacking(testPackages, currentULD, strategy);

        // Check if package was successfully placed (not in excluded list)
        const wasExcluded = result.excludedPackages?.some(ep => ep.id === pkg.id);
        
        if (!wasExcluded && result.packages.some(p => p.id === pkg.id)) {
          // Package was successfully placed!
          const updatedULD = {
            ...currentULD,
            packages: result.packages,
            currentWeight: currentULD.currentWeight + pkg.weight,
            utilization: ((currentULD.currentWeight + pkg.weight) / currentULD.maxWeight) * 100,
            stability: result.stability
          };
          
          updatedULDs = updatedULDs.map(u => u.id === uld.id ? updatedULD : u);
          remainingPending = remainingPending.filter(p => p.id !== pkg.id);
          placed = true;
          placedCount++;
          
          toast.success(`✓ ${pkg.name} placed in ${uld.name}`, { duration: 3000 });
          break; // Move to next package
        }
      }
      
      if (!placed) {
        console.log(`Could not place package: ${pkg.name}`);
      }
    }

    // Update ULDs with new packages
    setUlds(updatedULDs);

    // Update pending packages
    setPendingPackages(remainingPending);

    if (placedCount > 0) {
      toast.success(`🎉 Rearrangement complete: ${placedCount} package(s) placed from pending list`);
    } else {
      toast.warning('Could not place any pending packages. Try creating a larger ULD or adjusting package dimensions.');
    }
  };

  // Global optimization - can move packages between ULDs for better strategy
  const handleGlobalOptimization = () => {
    const availableULDs = ulds.filter(u => u.status === 'in-progress');
    
    if (availableULDs.length === 0) {
      toast.error('No available ULDs to optimize');
      return;
    }

    setIsOptimizing(true);
    
    setTimeout(() => {
      // Collect all packages from all available ULDs + pending packages
      const allPackages: Package[] = [];
      
      availableULDs.forEach(uld => {
        allPackages.push(...uld.packages.map(p => ({ ...p, position: undefined })));
      });
      
      allPackages.push(...pendingPackages);
      
      // Sort by strategy priority
      const sortedPackages = [...allPackages].sort((a, b) => {
        switch (strategy) {
          case 'maxWeight':
            return b.weight - a.weight;
          case 'fragile':
            return (b.fragile ? 1 : 0) - (a.fragile ? 1 : 0);
          case 'maxSpace':
            const volA = a.dimensions.length * a.dimensions.width * a.dimensions.height;
            const volB = b.dimensions.length * b.dimensions.width * b.dimensions.height;
            return volB - volA;
          default:
            return 0;
        }
      });
      
      // Clear all available ULDs
      let updatedULDs = ulds.map(u => {
        if (u.status === 'in-progress') {
          return { ...u, packages: [], currentWeight: 0, utilization: 0, stability: 100 };
        }
        return u;
      });
      
      let remainingPackages = [...sortedPackages];
      let totalPlaced = 0;
      
      // Try to place each package in best ULD
      for (const pkg of sortedPackages) {
        let placed = false;
        
        for (const uld of availableULDs) {
          const currentULD = updatedULDs.find(u => u.id === uld.id)!;
          
          // Check basic constraints
          const margin = 0.02;
          if (
            pkg.dimensions.length > currentULD.dimensions.length - margin * 2 ||
            pkg.dimensions.width > currentULD.dimensions.width - margin * 2 ||
            pkg.dimensions.height > currentULD.dimensions.height ||
            currentULD.currentWeight + pkg.weight > currentULD.maxWeight
          ) {
            continue;
          }
          
          // Try to add package
          const testPackages = [...currentULD.packages, pkg];
          const result = optimizePackagePacking(testPackages, currentULD, strategy);
          
          const wasExcluded = result.excludedPackages?.some(ep => ep.id === pkg.id);
          
          if (!wasExcluded && result.packages.some(p => p.id === pkg.id)) {
            const updatedULD = {
              ...currentULD,
              packages: result.packages,
              currentWeight: currentULD.currentWeight + pkg.weight,
              utilization: ((currentULD.currentWeight + pkg.weight) / currentULD.maxWeight) * 100,
              stability: result.stability
            };
            
            updatedULDs = updatedULDs.map(u => u.id === uld.id ? updatedULD : u);
            remainingPackages = remainingPackages.filter(p => p.id !== pkg.id);
            placed = true;
            totalPlaced++;
            break;
          }
        }
      }
      
      // Update state
      setUlds(updatedULDs);
      setPendingPackages(remainingPackages);
      setIsOptimizing(false);
      
      toast.success(
        `Global optimization complete!\n✓ ${totalPlaced} packages placed\n⏳ ${remainingPackages.length} packages in pending`,
        { duration: 5000 }
      );
    }, 2000);
  };

  // Re-optimize when strategy changes
  useEffect(() => {
    if (activeULD && activeULD.packages.length > 0) {
      autoOptimizeULD(activeULD);
    }
  }, [strategy]);

  const handleOptimizeULD = () => {
    if (!activeULD || activeULD.packages.length === 0) {
      toast.error('Add packages first');
      return;
    }

    setIsOptimizing(true);
    setTimeout(() => {
      const result = optimizePackagePacking(activeULD.packages, activeULD, strategy);
      const updatedULD = {
        ...activeULD,
        packages: result.packages || activeULD.packages,
        stability: result.stability
      };
      setUlds(prev => prev.map(u => u.id === activeULD.id ? updatedULD : u));
      setIsOptimizing(false);
      toast.success(`Optimized ${activeULD.name} using ${strategyLabels[strategy]} strategy`);
    }, 2000);
  };

  const handleCompleteULD = () => {
    if (!activeULD) return;
    // Ensure packages array exists before completing
    const updatedULD = { 
      ...activeULD, 
      status: 'completed' as const,
      packages: activeULD.packages || [] // Ensure packages is always defined
    };
    setUlds(prev => prev.map(u => u.id === activeULD.id ? updatedULD : u));
    toast.success(`${activeULD.name} marked as completed and ready for aircraft loading`);
    setActiveULDId(null);
  };

  const handleOptimizeHold = () => {
    // Check if any completed ULDs exceed hold dimensions
    const completedULDs = ulds.filter(u => u.status === 'completed');
    const oversizedULDs = completedULDs.filter(uld =>
      uld.dimensions.length > holdDimensions.length ||
      uld.dimensions.width > holdDimensions.width ||
      uld.dimensions.height > holdDimensions.height
    );

    if (oversizedULDs.length > 0) {
      const names = oversizedULDs.map(u => u.name).join(', ');
      toast.error(
        `Cannot load oversized ULDs: ${names}. These exceed hold dimensions (${holdDimensions.length}×${holdDimensions.width}×${holdDimensions.height}m).`
      );
    }

    setIsOptimizing(true);
    setTimeout(() => {
      // Ensure all ULDs have packages array before optimization
      const safeULDs = ulds.map(u => ({
        ...u,
        packages: u.packages || [] // Defensive: ensure packages always exists
      }));
      
      const optimizedULDs = optimizeULDPlacement(safeULDs, holdDimensions, strategy);
      setUlds(prev => prev.map(u => {
        const optimized = optimizedULDs.find(ou => ou.id === u.id);
        return optimized || u;
      }));
      setIsOptimizing(false);
      
      const loadedCount = optimizedULDs.length;
      const skippedCount = completedULDs.length - loadedCount;
      
      if (skippedCount > 0) {
        toast.warning(`Loaded ${loadedCount} ULDs. ${skippedCount} ULDs could not fit in the hold.`);
      } else {
        toast.success(`Aircraft hold optimized with ${loadedCount} ULDs loaded`);
      }
    }, 2000);
  };

  // Manual ULD placement handler
  const handleManualULDPlacement = (uldId: string, position: { x: number; y: number; z: number }) => {
    // Save current state to history before making changes
    const currentULD = ulds.find(u => u.id === uldId);
    if (currentULD) {
      setPlacementHistory(prev => [...prev, {
        ulds: JSON.parse(JSON.stringify(ulds)), // Deep copy
        action: `Placed ${currentULD.name}`
      }]);
    }
    
    setUlds(prev => prev.map(u => {
      if (u.id === uldId) {
        return {
          ...u,
          position,
          status: 'loaded' as const
        };
      }
      return u;
    }));
    setSelectedULDForPlacement(null);
    toast.success('ULD placed manually');
  };

  // Undo last placement
  const handleUndoPlacement = () => {
    if (placementHistory.length === 0) {
      toast.error('No actions to undo');
      return;
    }
    
    const lastState = placementHistory[placementHistory.length - 1];
    setUlds(lastState.ulds);
    setPlacementHistory(prev => prev.slice(0, -1));
    toast.success(`Undone: ${lastState.action}`);
  };

  const completedULDs = ulds.filter(u => u.status === 'completed' || u.status === 'loaded');

  return (
    <div className="relative size-full bg-gradient-to-br from-[#003135] via-[#005D63] to-[#003135]">
      <Container3 />
      <div className="absolute inset-0 flex flex-col">
        <Header strategy={strategy} setStrategy={setStrategy} activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <div className="flex-1 p-6 overflow-auto">
          {activeTab === 'packing' ? (
            <div className="grid grid-cols-[420px_1fr] gap-6 h-full">
              {/* Left Panel - Controls */}
              <div className="space-y-4 overflow-auto">
                <button onClick={() => setUldConfigOpen(true)} className="w-full bg-gradient-to-r from-[#005D63] to-[#004852] text-white py-3 rounded-lg hover:opacity-90 transition-all">
                  + Create New ULD Container
                </button>

                {/* ULD Selector */}
                {ulds.length > 0 && (
                  <div className="bg-[rgba(255,255,255,0.5)] rounded-lg p-4 border border-[rgba(255,255,255,0.2)]">
                    <Label className="text-[#0f172b] mb-2 block">Active ULD Container</Label>
                    <Select value={activeULDId || ''} onValueChange={setActiveULDId}>
                      <SelectTrigger className="bg-white"><SelectValue placeholder="Select ULD" /></SelectTrigger>
                      <SelectContent>
                        {ulds.filter(u => u.status === 'in-progress').map(uld => (
                          <SelectItem key={uld.id} value={uld.id}>{uld.name} ({uld.packages.length} pkgs, {uld.currentWeight}kg)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Global Optimization Button */}
                {ulds.filter(u => u.status === 'in-progress').length > 0 && (
                  <button 
                    onClick={handleGlobalOptimization} 
                    disabled={isOptimizing}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {isOptimizing ? '⟳ Optimizing...' : '🔄 Global Optimization'}
                  </button>
                )}

                {activeULD && (
                  <>
                    <button onClick={() => setDialogOpen(true)} className="w-full bg-white border-2 border-[#005D63] text-[#005D63] py-3 rounded-lg hover:bg-[#005D63] hover:text-white transition-all">
                      + Add Package to {activeULD.name}
                    </button>

                    <div className="bg-gradient-to-r from-[#005D63]/20 to-[#004852]/20 border border-[#005D63]/50 rounded-lg p-3 text-white text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="size-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="font-bold">Auto-Optimization Active</span>
                      </div>
                      <div className="text-xs text-[#bedbff]">
                        Packages are automatically optimized using {strategyLabels[strategy]} strategy
                      </div>
                    </div>

                    <button onClick={handleCompleteULD} disabled={activeULD.packages.length === 0} className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 disabled:opacity-50">
                      ✓ Complete ULD & Move to Hold
                    </button>

                    {/* Pending Packages Alert */}
                    {pendingPackages.length > 0 && (
                      <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 text-white text-sm">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="size-4 text-yellow-400" />
                          <span className="font-bold">Pending Packages: {pendingPackages.length}</span>
                        </div>
                        <div className="text-xs text-yellow-200">
                          Packages waiting for placement. System will auto-place when space becomes available.
                        </div>
                        <button
                          onClick={tryRearrangePendingPackages}
                          className="mt-2 w-full bg-yellow-600 text-white py-2 px-3 rounded text-xs hover:bg-yellow-700 transition-all"
                        >
                          ⟳ Try Rearrange Now
                        </button>
                      </div>
                    )}

                    {/* ULD Info */}
                    <div className="bg-[rgba(255,255,255,0.5)] rounded-lg p-4 space-y-2 border border-[rgba(255,255,255,0.2)]">
                      <h3 className="text-[#0f172b] font-bold">{activeULD.name} Status</h3>
                      <div className="text-[#0f172b] text-sm space-y-1">
                        <div>Type: {activeULD.type}</div>
                        <div>Dimensions: {activeULD.dimensions.length}×{activeULD.dimensions.width}×{activeULD.dimensions.height}m</div>
                        <div>Weight: {activeULD.currentWeight}/{activeULD.maxWeight}kg ({activeULD.utilization.toFixed(1)}%)</div>
                        <div>Packages: {activeULD.packages.length}</div>
                        <div className={activeULD.stability > 80 ? 'text-green-600' : 'text-yellow-600'}>Stability: {activeULD.stability.toFixed(0)}%</div>
                      </div>
                    </div>

                    {/* Package List */}
                    <div className="bg-[rgba(255,255,255,0.5)] rounded-lg p-4 max-h-[300px] overflow-auto border border-[rgba(255,255,255,0.2)]">
                      <h3 className="text-[#0f172b] font-bold mb-3">Package List ({activeULD.packages.length})</h3>
                      {activeULD.packages.length === 0 ? (
                        <p className="text-[#90a1b9] text-center py-4">No packages added yet</p>
                      ) : (
                        <div className="space-y-2">
                          {activeULD.packages.map(pkg => (
                            <div key={pkg.id} className="bg-white rounded p-3 text-sm">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-bold text-[#0f172b]">{pkg.name}</div>
                                  <div className="text-[#64748b]">{pkg.dimensions.length}×{pkg.dimensions.width}×{pkg.dimensions.height}m, {pkg.weight}kg</div>
                                </div>
                                {pkg.fragile && <span className="text-[#FDC700]">⚠</span>}
                              </div>
                              {pkg.position && <div className="text-[#00b8db] text-xs mt-1">✓ Optimized</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pending Packages List */}
                    {pendingPackages.length > 0 && (
                      <div className="bg-[rgba(255,255,255,0.5)] rounded-lg p-4 max-h-[250px] overflow-auto border border-[rgba(255,255,255,0.2)]">
                        <h3 className="text-[#0f172b] font-bold mb-3 flex items-center gap-2">
                          <AlertCircle className="size-4 text-yellow-600" />
                          Pending List ({pendingPackages.length})
                        </h3>
                        <div className="space-y-2">
                          {pendingPackages.map(pkg => (
                            <div key={pkg.id} className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-bold text-yellow-900">{pkg.name}</div>
                                  <div className="text-yellow-700 text-xs">{pkg.dimensions.length}×{pkg.dimensions.width}×{pkg.dimensions.height}m, {pkg.weight}kg</div>
                                </div>
                                {pkg.fragile && <span className="text-red-600">⚠</span>}
                              </div>
                              <div className="text-yellow-600 text-xs mt-1">⏳ Waiting for placement</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Exceeding ULDs' Dimensions List */}
                    {exceedingPackages.length > 0 && (
                      <div className="bg-[rgba(255,255,255,0.5)] rounded-lg p-4 max-h-[250px] overflow-auto border border-[rgba(255,255,255,0.2)]">
                        <h3 className="text-[#0f172b] font-bold mb-3 flex items-center gap-2">
                          <AlertCircle className="size-4 text-red-600" />
                          Exceeding ULDs' Dimensions ({exceedingPackages.length})
                        </h3>
                        <div className="space-y-2">
                          {exceedingPackages.map(pkg => (
                            <div key={pkg.id} className="bg-red-50 border border-red-400 rounded p-3 text-sm">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-bold text-red-900">{pkg.name}</div>
                                  <div className="text-red-700 text-xs">{pkg.dimensions.length}×{pkg.dimensions.width}×{pkg.dimensions.height}m, {pkg.weight}kg</div>
                                </div>
                                {pkg.fragile && <span className="text-red-600">⚠⚠</span>}
                              </div>
                              <div className="text-red-600 text-xs mt-1"> Too large for all existing ULDs</div>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => tryPlaceExceedingPackages()}
                          className="mt-2 w-full bg-red-600 text-white py-2 px-3 rounded text-xs hover:bg-red-700 transition-all"
                        >
                          ⟳ Try Place in Available ULDs
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right Panel - 3D Visualization */}
              <div className="bg-[#1a2332] rounded-[16px] border border-[rgba(255,255,255,0.2)] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] relative overflow-hidden">
                {activeULD ? (
                  <CargoVisualization3D packages={activeULD.packages} sensorData={sensorData} containerType={activeULD} />
                ) : (
                  <div className="flex items-center justify-center h-full text-white/50">
                    <div className="text-center">
                      <PackageIcon className="size-24 mx-auto mb-4 opacity-50" />
                      <p className="text-xl">Create or select a ULD to begin</p>
                    </div>
                  </div>
                )}
                
                {/* Overlay Info */}
                {activeULD && (
                  <>
                    <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white text-sm">
                      <div><strong>{activeULD.name}</strong></div>
                      <div>Packages: {activeULD.packages.length}</div>
                      <div>Weight: {activeULD.currentWeight}kg</div>
                    </div>
                    <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg p-2 text-white text-xs">
                      Drag to rotate • Scroll to zoom
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[420px_1fr] gap-6 h-full">
              {/* Left Panel */}
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button 
                    onClick={handleOptimizeHold} 
                    disabled={isOptimizing || completedULDs.length === 0} 
                    className="flex-1 bg-gradient-to-r from-[#005D63] to-[#004852] text-white py-3 rounded-lg hover:opacity-90 disabled:opacity-50 shadow-lg" 
                    style={{ textShadow: '0 0 10px rgba(255, 255, 255, 0.5)' }}
                  >
                    {isOptimizing ? 'Optimizing...' : 'AI Optimize Hold Layout'}
                  </button>
                  <button
                    onClick={handleUndoPlacement}
                    disabled={placementHistory.length === 0}
                    className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg shadow-lg transition-all flex items-center gap-2"
                    title="Undo last placement"
                  >
                    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span className="font-bold">Undo</span>
                  </button>
                </div>

                {placementHistory.length > 0 && (
                  <div className="bg-orange-100 border border-orange-400 rounded-lg p-2 text-xs text-orange-900">
                    💾 {placementHistory.length} action{placementHistory.length > 1 ? 's' : ''} in history
                  </div>
                )}

                <div className="bg-[rgba(255,255,255,0.5)] rounded-lg p-4 space-y-2 border border-[rgba(255,255,255,0.2)]">
                  <h3 className="text-[#0f172b] font-bold flex items-center gap-2">
                    <Plane className="size-5" />
                    Aircraft Hold Status
                  </h3>
                  <div className="text-[#0f172b] text-sm space-y-1">
                    <div>Aircraft: {aircraftConfig.name}</div>
                    <div>Dimensions: {aircraftConfig.holdDimensions.length}×{aircraftConfig.holdDimensions.width}×{aircraftConfig.holdDimensions.height}m</div>
                    <div>ULDs Loaded: {ulds.filter(u => u.status === 'loaded').length}/{aircraftConfig.maxULDs}</div>
                    <div>Total Weight: {ulds.filter(u => u.status === 'loaded').reduce((sum, u) => sum + u.currentWeight, 0)}kg / {aircraftConfig.maxWeight}kg</div>
                  </div>
                </div>

                <div className="bg-[rgba(255,255,255,0.5)] rounded-lg p-4 max-h-[400px] overflow-auto border border-[rgba(255,255,255,0.2)]">
                  <h3 className="text-[#0f172b] font-bold mb-3">Completed ULDs ({completedULDs.length})</h3>
                  {selectedULDForPlacement && (
                    <div className="bg-blue-50 border border-blue-400 rounded p-2 mb-3 text-sm text-blue-900">
                      📍 Click on the hold to place {ulds.find(u => u.id === selectedULDForPlacement)?.name}
                    </div>
                  )}
                  <div className="space-y-2">
                    {completedULDs.map(uld => (
                      <div 
                        key={uld.id} 
                        onClick={() => {
                          if (uld.status !== 'loaded') {
                            setSelectedULDForPlacement(uld.id);
                            toast.info(`Click on the hold to place ${uld.name}`);
                          }
                        }}
                        className={`bg-white rounded p-3 text-sm ${
                          uld.status === 'loaded' ? 'border-2 border-green-500' : 
                          selectedULDForPlacement === uld.id ? 'border-2 border-blue-500 cursor-pointer' :
                          'cursor-pointer hover:border-2 hover:border-blue-300'
                        } transition-all`}
                      >
                        <div className="font-bold text-[#0f172b]">{uld.name}</div>
                        <div className="text-[#64748b]">{uld.packages.length} packages, {uld.currentWeight}kg</div>
                        <div className={`text-xs mt-1 ${uld.status === 'loaded' ? 'text-green-600' : 'text-blue-600'}`}>
                          {uld.status === 'loaded' ? '✓ Loaded in hold' : '👆 Click to place manually'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Panel - Aircraft Hold View */}
              <div className="bg-[#1a2332] rounded-[16px] border border-[rgba(255,255,255,0.2)] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] relative overflow-hidden">
                <AircraftHoldView3D 
                  ulds={ulds} 
                  aircraftConfig={aircraftConfig}
                  onConfigureAircraft={() => setAircraftConfigOpen(true)}
                  selectedULDForPlacement={selectedULDForPlacement}
                  onManualPlace={handleManualULDPlacement}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <AddPackageDialog open={dialogOpen} onOpenChange={setDialogOpen} onAddPackage={handleAddPackage} />
      <ULDConfigurator open={uldConfigOpen} onOpenChange={setUldConfigOpen} onCreateULD={handleCreateULD} />
      <AircraftConfigDialog 
        open={aircraftConfigOpen} 
        onOpenChange={setAircraftConfigOpen} 
        currentConfig={aircraftConfig}
        onConfigureAircraft={(config) => {
          setAircraftConfig(config);
          toast.success(`Aircraft configured: ${config.name}`);
        }}
      />
    </div>
  );
}