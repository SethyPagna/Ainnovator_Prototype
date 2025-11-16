import svgPaths from "./svg-96rzmrol0f";
import imgImage1 from "figma:asset/60938776d8fe2945f4f3a1774ffad71a1d8df7cf.png";
import imgImage2 from "figma:asset/51379c21d6058ad30d1a998c14292f8a7d5c3cd8.png";

function Container() {
  return <div className="absolute bg-[#2b7fff] blur-3xl filter left-[319.25px] opacity-[0.613] rounded-[1.67772e+07px] size-[384px] top-0" data-name="Container" />;
}

function Container1() {
  return <div className="absolute bg-[#ad46ff] blur-3xl filter left-[573.75px] opacity-[0.887] rounded-[1.67772e+07px] size-[384px] top-[331.5px]" data-name="Container" />;
}

function Container2() {
  return <div className="absolute bg-[#00b8db] blur-3xl filter left-[638.5px] opacity-[0.613] rounded-[1.67772e+07px] size-[384px] top-[279px]" data-name="Container" />;
}

function Container3() {
  return (
    <div className="absolute h-[663px] left-0 opacity-20 top-0 w-[1277px]" data-name="Container">
      <Container />
      <Container1 />
      <Container2 />
    </div>
  );
}

function Icon() {
  return (
    <div className="h-[32px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[12.5%_58.33%_58.33%_12.5%]" data-name="Vector">
        <div className="absolute inset-[-14.29%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
            <path d={svgPaths.p1776fb00} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[12.5%_12.5%_58.33%_58.33%]" data-name="Vector">
        <div className="absolute inset-[-14.29%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
            <path d={svgPaths.p1776fb00} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[58.33%_12.5%_12.5%_58.33%]" data-name="Vector">
        <div className="absolute inset-[-14.29%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
            <path d={svgPaths.p1776fb00} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[58.33%_58.33%_12.5%_12.5%]" data-name="Vector">
        <div className="absolute inset-[-14.29%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
            <path d={svgPaths.p1776fb00} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.66667" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="relative rounded-[16px] shadow-[0px_10px_15px_-3px_rgba(43,127,255,0.5),0px_4px_6px_-4px_rgba(43,127,255,0.5)] shrink-0 size-[56px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col items-start pb-0 pt-[12px] px-[12px] relative size-[56px]">
        <Icon />
      </div>
    </div>
  );
}

function Icon1() {
  return (
    <div className="absolute left-[237.7px] size-[20px] top-[6px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_1_200)" id="Icon">
          <path d={svgPaths.p17422100} id="Vector" stroke="var(--stroke-0, #FDC700)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M16.6667 1.66667V5" id="Vector_2" stroke="var(--stroke-0, #FDC700)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d="M18.3333 3.33333H15" id="Vector_3" stroke="var(--stroke-0, #FDC700)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
          <path d={svgPaths.p2661f400} id="Vector_4" stroke="var(--stroke-0, #FDC700)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667" />
        </g>
        <defs>
          <clipPath id="clip0_1_200">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Heading() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Heading 1">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[32px] left-0 not-italic text-[24px] text-nowrap text-white top-[-2px] whitespace-pre">Air Cargo Digital Twin</p>
      <Icon1 />
    </div>
  );
}

function Paragraph() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[#bedbff] text-[14px] text-nowrap top-[-1.5px] whitespace-pre">AI-Powered 3D Cargo Optimization System</p>
    </div>
  );
}

function Container5() {
  return (
    <div className="basis-0 grow h-[54px] min-h-px min-w-px relative shrink-0" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col gap-[2px] h-[54px] items-start relative w-full">
        <Heading />
        <Paragraph />
      </div>
    </div>
  );
}

function Container6() {
  return (
    <div className="h-[56px] relative shrink-0 w-[337.508px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[16px] h-[56px] items-center relative w-[337.508px]">
        <Container4 />
        <Container5 />
      </div>
    </div>
  );
}

function Text() {
  return (
    <div className="h-[20px] relative shrink-0 w-[53.844px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[20px] relative w-[53.844px]">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[#bedbff] text-[14px] text-nowrap top-[-1.5px] whitespace-pre">Strategy:</p>
      </div>
    </div>
  );
}

function Option() {
  return (
    <div className="bg-[#0f172b] h-0 relative shrink-0 w-full" data-name="Option">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[normal] left-0 not-italic text-[16px] text-white top-0 w-0">Balanced</p>
    </div>
  );
}

function Option1() {
  return (
    <div className="bg-[#0f172b] h-0 relative shrink-0 w-full" data-name="Option">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[normal] left-0 not-italic text-[16px] text-white top-0 w-0">Max Weight</p>
    </div>
  );
}

function Option2() {
  return (
    <div className="bg-[#0f172b] h-0 relative shrink-0 w-full" data-name="Option">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[normal] left-0 not-italic text-[16px] text-white top-0 w-0">Max Space</p>
    </div>
  );
}

function Option3() {
  return (
    <div className="bg-[#0f172b] h-0 relative shrink-0 w-full" data-name="Option">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[normal] left-0 not-italic text-[16px] text-white top-0 w-0">Fragile Priority</p>
    </div>
  );
}

function Option4() {
  return (
    <div className="bg-[#0f172b] h-0 relative shrink-0 w-full" data-name="Option">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[normal] left-0 not-italic text-[16px] text-white top-0 w-0">Safety First</p>
    </div>
  );
}

function Option5() {
  return (
    <div className="bg-[#0f172b] h-0 relative shrink-0 w-full" data-name="Option">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[normal] left-0 not-italic text-[16px] text-white top-0 w-0">Cost Optimized</p>
    </div>
  );
}

function Option6() {
  return (
    <div className="bg-[#0f172b] h-0 relative shrink-0 w-full" data-name="Option">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[normal] left-0 not-italic text-[16px] text-white top-0 w-0">Time Critical</p>
    </div>
  );
}

function Dropdown() {
  return (
    <div className="basis-0 grow h-[23.5px] min-h-px min-w-px relative shrink-0" data-name="Dropdown">
      <div className="size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col h-[23.5px] items-start pb-0 pr-[836.344px] relative w-full">
          <Option />
          <Option1 />
          <Option2 />
          <Option3 />
          <Option4 />
          <Option5 />
          <Option6 />
        </div>
      </div>
    </div>
  );
}

function Container7() {
  return (
    <div className="bg-[rgba(255,255,255,0.1)] h-[41.5px] relative rounded-[14px] shrink-0 w-[225.344px]" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[8px] h-[41.5px] items-center px-[17px] py-px relative w-[225.344px]">
        <Text />
        <Dropdown />
      </div>
    </div>
  );
}

function Icon2() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon">
          <path d={svgPaths.p253800} id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M8 14.6667V8" id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p62bd0c0} id="Vector_3" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M5 2.84667L11 6.28" id="Vector_4" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Text1() {
  return (
    <div className="basis-0 grow h-[24px] min-h-px min-w-px relative shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[24px] relative w-full">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[16px] text-nowrap text-white top-[-2px] whitespace-pre">Package Packing</p>
      </div>
    </div>
  );
}

function Button() {
  return (
    <div className="basis-0 bg-gradient-to-r from-[#2b7fff] grow h-[44px] min-h-px min-w-px relative rounded-[10px] shadow-[0px_10px_15px_-3px_rgba(43,127,255,0.5),0px_4px_6px_-4px_rgba(43,127,255,0.5)] shrink-0 to-[#00b8db]" data-name="Button">
      <div className="flex flex-row items-center size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[8px] h-[44px] items-center px-[24px] py-0 relative w-full">
          <Icon2 />
          <Text1 />
        </div>
      </div>
    </div>
  );
}

function Icon3() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon">
          <path d={svgPaths.p37181900} id="Vector" stroke="var(--stroke-0, #BEDBFF)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Text2() {
  return (
    <div className="basis-0 grow h-[24px] min-h-px min-w-px relative shrink-0" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[24px] relative w-full">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-0 not-italic text-[#bedbff] text-[16px] text-nowrap top-[-2px] whitespace-pre">ULD Loading</p>
      </div>
    </div>
  );
}

function Button1() {
  return (
    <div className="h-[44px] relative rounded-[10px] shrink-0 w-[165.281px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[8px] h-[44px] items-center px-[24px] py-0 relative w-[165.281px]">
        <Icon3 />
        <Text2 />
      </div>
    </div>
  );
}

function Container8() {
  return (
    <div className="basis-0 bg-[rgba(255,255,255,0.1)] grow h-[58px] min-h-px min-w-px relative rounded-[14px] shrink-0" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <div className="size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[8px] h-[58px] items-start pb-px pt-[7px] px-[7px] relative w-full">
          <Button />
          <Button1 />
        </div>
      </div>
    </div>
  );
}

function Container9() {
  return (
    <div className="h-[58px] relative shrink-0 w-[617px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[12px] h-[58px] items-center relative w-[617px]">
        <Container7 />
        <Container8 />
      </div>
    </div>
  );
}

function Container10() {
  return (
    <div className="content-stretch flex h-[58px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Container6 />
      <Container9 />
    </div>
  );
}

function Header() {
  return (
    <div className="bg-[rgba(255,255,255,0.05)] h-[107px] relative shrink-0" data-name="Header">
      <div aria-hidden="true" className="absolute border-[0px_0px_1px] border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col h-[107px] items-start pb-px pt-[24px] px-[32px] relative">
        <Container10 />
      </div>
    </div>
  );
}

function Icon4() {
  return (
    <div className="absolute left-[136.53px] size-[16px] top-[12px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon">
          <path d="M3.33333 8H12.6667" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M8 3.33333V12.6667" id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-gradient-to-r from-[#2b7fff] h-[40px] relative rounded-[8px] shrink-0 to-[#00b8db] w-[420px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[40px] relative w-[420px]">
        <Icon4 />
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-[168.53px] not-italic text-[14px] text-nowrap text-white top-[8.5px] whitespace-pre">Add New Package</p>
      </div>
    </div>
  );
}

function Icon5() {
  return (
    <div className="absolute left-[129.91px] size-[16px] top-[12px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g clipPath="url(#clip0_1_165)" id="Icon">
          <path d={svgPaths.p29348f80} id="Vector" stroke="var(--stroke-0, #00B8DB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p2bdb5600} id="Vector_2" stroke="var(--stroke-0, #00B8DB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M3.33333 4V6.66667" id="Vector_3" stroke="var(--stroke-0, #00B8DB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M12.6667 9.33333V12" id="Vector_4" stroke="var(--stroke-0, #00B8DB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M6.66667 1.33333V2.66667" id="Vector_5" stroke="var(--stroke-0, #00B8DB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M4.66667 5.33333H2" id="Vector_6" stroke="var(--stroke-0, #00B8DB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M14 10.6667H11.3333" id="Vector_7" stroke="var(--stroke-0, #00B8DB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M7.33333 2H6" id="Vector_8" stroke="var(--stroke-0, #00B8DB)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
        <defs>
          <clipPath id="clip0_1_165">
            <rect fill="white" height="16" width="16" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-white h-[40px] opacity-50 relative rounded-[8px] shrink-0 w-[420px]" data-name="Button">
      <div aria-hidden="true" className="absolute border-2 border-[#00b8db] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[40px] relative w-[420px]">
        <Icon5 />
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-[161.91px] not-italic text-[#00b8db] text-[14px] text-nowrap top-[8.5px] whitespace-pre">AI Optimize Packing</p>
      </div>
    </div>
  );
}

function Icon6() {
  return (
    <div className="absolute left-0 size-[16px] top-[4px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon">
          <path d={svgPaths.p24404e00} id="Vector" stroke="var(--stroke-0, #0F172B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p269b6380} id="Vector_2" stroke="var(--stroke-0, #0F172B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M8 14.6667V8" id="Vector_3" stroke="var(--stroke-0, #0F172B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function PackagingMode() {
  return (
    <div className="h-[24px] relative shrink-0 w-[386px]" data-name="PackagingMode">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[24px] relative w-[386px]">
        <Icon6 />
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[24px] left-[24px] not-italic text-[#0f172b] text-[16px] text-nowrap top-[-2px] whitespace-pre">Configuration</p>
      </div>
    </div>
  );
}

function PrimitiveLabel() {
  return (
    <div className="h-[20px] relative shrink-0 w-full" data-name="Primitive.label">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-neutral-950 text-nowrap top-[-1.5px] whitespace-pre">ULD Container Type</p>
    </div>
  );
}

function PrimitiveSpan() {
  return (
    <div className="h-[20px] relative shrink-0 w-[180.781px]" data-name="Primitive.span">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex gap-[8px] h-[20px] items-center overflow-clip relative rounded-[inherit] w-[180.781px]">
        <p className="font-['Arial:Regular',sans-serif] leading-[20px] not-italic relative shrink-0 text-[14px] text-neutral-950 text-nowrap whitespace-pre">AKE - 3.5×3.0×2.5m (3500kg)</p>
      </div>
    </div>
  );
}

function Icon7() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon" opacity="0.5">
          <path d="M4 6L8 10L12 6" id="Vector" stroke="var(--stroke-0, #717182)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function PrimitiveButton() {
  return (
    <div className="bg-[#f3f3f5] h-[36px] relative rounded-[8px] shrink-0 w-full" data-name="Primitive.button">
      <div aria-hidden="true" className="absolute border border-[rgba(0,0,0,0)] border-solid inset-0 pointer-events-none rounded-[8px]" />
      <div className="flex flex-row items-center size-full">
        <div className="box-border content-stretch flex h-[36px] items-center justify-between px-[13px] py-px relative w-full">
          <PrimitiveSpan />
          <Icon7 />
        </div>
      </div>
    </div>
  );
}

function PackagingMode1() {
  return (
    <div className="basis-0 grow min-h-px min-w-px relative shrink-0 w-[386px]" data-name="PackagingMode">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col gap-[8px] h-full items-start relative w-[386px]">
        <PrimitiveLabel />
        <PrimitiveButton />
      </div>
    </div>
  );
}

function Card() {
  return (
    <div className="bg-[rgba(255,255,255,0.5)] h-[158px] relative rounded-[14px] shrink-0 w-[420px]" data-name="Card">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col gap-[36px] h-[158px] items-start pl-[17px] pr-px py-[17px] relative w-[420px]">
        <PackagingMode />
        <PackagingMode1 />
      </div>
    </div>
  );
}

function Icon8() {
  return (
    <div className="absolute left-0 size-[16px] top-[5.5px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g clipPath="url(#clip0_1_175)" id="Icon">
          <path d={svgPaths.p2146f640} id="Vector" stroke="var(--stroke-0, #0F172B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p3dd52f00} id="Vector_2" stroke="var(--stroke-0, #0F172B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p2d792300} id="Vector_3" stroke="var(--stroke-0, #0F172B)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
        <defs>
          <clipPath id="clip0_1_175">
            <rect fill="white" height="16" width="16" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Heading1() {
  return (
    <div className="h-[27px] relative shrink-0 w-full" data-name="Heading 3">
      <Icon8 />
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[27px] left-[24px] not-italic text-[#0f172b] text-[18px] top-[-1.5px] w-[127px]">Package List (0)</p>
    </div>
  );
}

function PackagingMode2() {
  return (
    <div className="h-[60px] relative shrink-0 w-[418px]" data-name="PackagingMode">
      <div aria-hidden="true" className="absolute border-[0px_0px_1px] border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col h-[60px] items-start pb-px pt-[16px] px-[16px] relative w-[418px]">
        <Heading1 />
      </div>
    </div>
  );
}

function Icon9() {
  return (
    <div className="absolute left-[161.5px] size-[48px] top-[48px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 48 48">
        <g id="Icon" opacity="0.5">
          <path d={svgPaths.p94e0000} id="Vector" stroke="var(--stroke-0, #90A1B9)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          <path d="M24 44V24" id="Vector_2" stroke="var(--stroke-0, #90A1B9)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          <path d="M6.57996 14L24 24L41.42 14" id="Vector_3" stroke="var(--stroke-0, #90A1B9)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
          <path d="M15 8.54004L33 18.84" id="Vector_4" stroke="var(--stroke-0, #90A1B9)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        </g>
      </svg>
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="absolute h-[20px] left-0 top-[108px] w-[371px]" data-name="Paragraph">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-[185.7px] not-italic text-[#90a1b9] text-[14px] text-center text-nowrap top-[-1.5px] translate-x-[-50%] whitespace-pre">No packages added yet</p>
    </div>
  );
}

function Container11() {
  return (
    <div className="h-[176px] relative shrink-0 w-full" data-name="Container">
      <Icon9 />
      <Paragraph1 />
    </div>
  );
}

function PackagingMode3() {
  return (
    <div className="basis-0 grow min-h-px min-w-px relative shrink-0 w-[418px]" data-name="PackagingMode">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col h-full items-start overflow-clip pb-0 pl-[16px] pr-[31px] pt-[16px] relative rounded-[inherit] w-[418px]">
        <Container11 />
      </div>
    </div>
  );
}

function Card1() {
  return (
    <div className="basis-0 bg-[rgba(255,255,255,0.5)] grow min-h-px min-w-px relative rounded-[14px] shrink-0 w-[420px]" data-name="Card">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col gap-[24px] h-full items-start overflow-clip p-px relative rounded-[inherit] w-[420px]">
        <PackagingMode2 />
        <PackagingMode3 />
      </div>
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[14px]" />
    </div>
  );
}

function Container12() {
  return (
    <div className="[grid-area:1_/_2] content-stretch flex flex-col gap-[16px] items-start overflow-clip relative shrink-0" data-name="Container">
      <Button2 />
      <Button3 />
      <Card />
      <Card1 />
    </div>
  );
}

function Container13() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.4)] box-border content-stretch flex h-[34px] items-start left-[562.97px] px-[17px] py-[9px] rounded-[10px] top-[449px] w-[197.031px]" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[10px]" />
      <p className="font-['Arial:Regular',sans-serif] leading-[16px] not-italic relative shrink-0 text-[12px] text-nowrap text-white whitespace-pre">Drag to rotate • Scroll to zoom</p>
    </div>
  );
}

function Container14() {
  return (
    <div className="content-stretch flex h-[16px] items-start opacity-75 relative shrink-0 w-full" data-name="Container">
      <p className="basis-0 font-['Arial:Regular',sans-serif] grow leading-[16px] min-h-px min-w-px not-italic relative shrink-0 text-[12px] text-white">ULD Container</p>
    </div>
  );
}

function Text3() {
  return (
    <div className="absolute h-[20px] left-[42.63px] opacity-75 top-[4px] w-[75.031px]" data-name="Text">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-white top-[-1.5px] w-[76px]">3.5×3×2.5m</p>
    </div>
  );
}

function Container15() {
  return (
    <div className="h-[28px] relative shrink-0 w-full" data-name="Container">
      <p className="absolute font-['Arial:Regular',sans-serif] leading-[28px] left-0 not-italic text-[20px] text-nowrap text-white top-[-2.5px] whitespace-pre">AKE</p>
      <Text3 />
    </div>
  );
}

function Container16() {
  return (
    <div className="content-stretch flex flex-col gap-[4px] h-[48px] items-start relative shrink-0 w-full" data-name="Container">
      <Container14 />
      <Container15 />
    </div>
  );
}

function Container17() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.4)] box-border content-stretch flex flex-col h-[82px] items-start left-[25px] pb-px pt-[17px] px-[25px] rounded-[14px] top-[25px] w-[167.656px]" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container16 />
    </div>
  );
}

function Text4() {
  return (
    <div className="h-[20px] opacity-75 relative shrink-0 w-[59.578px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[20px] relative w-[59.578px]">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-nowrap text-white top-[-1.5px] whitespace-pre">Packages:</p>
      </div>
    </div>
  );
}

function Text5() {
  return (
    <div className="h-[20px] relative shrink-0 w-[8.055px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[20px] relative w-[8.055px]">
        <p className="absolute font-['Arial:Bold',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-nowrap text-white top-[-1.5px] whitespace-pre">0</p>
      </div>
    </div>
  );
}

function Container18() {
  return (
    <div className="content-stretch flex h-[20px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Text4 />
      <Text5 />
    </div>
  );
}

function Text6() {
  return (
    <div className="h-[20px] opacity-75 relative shrink-0 w-[47.195px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[20px] relative w-[47.195px]">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-nowrap text-white top-[-1.5px] whitespace-pre">Weight:</p>
      </div>
    </div>
  );
}

function Text7() {
  return (
    <div className="h-[20px] relative shrink-0 w-[24.352px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[20px] relative w-[24.352px]">
        <p className="absolute font-['Arial:Bold',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-white top-[-1.5px] w-[25px]">0kg</p>
      </div>
    </div>
  );
}

function Container19() {
  return (
    <div className="content-stretch flex h-[20px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Text6 />
      <Text7 />
    </div>
  );
}

function Text8() {
  return (
    <div className="h-[20px] opacity-75 relative shrink-0 w-[39.617px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[20px] relative w-[39.617px]">
        <p className="absolute font-['Arial:Regular',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-nowrap text-white top-[-1.5px] whitespace-pre">Space:</p>
      </div>
    </div>
  );
}

function Text9() {
  return (
    <div className="h-[20px] relative shrink-0 w-[32.047px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border h-[20px] relative w-[32.047px]">
        <p className="absolute font-['Arial:Bold',sans-serif] leading-[20px] left-0 not-italic text-[14px] text-white top-[-1.5px] w-[33px]">0.0%</p>
      </div>
    </div>
  );
}

function Container20() {
  return (
    <div className="content-stretch flex h-[20px] items-center justify-between relative shrink-0 w-full" data-name="Container">
      <Text8 />
      <Text9 />
    </div>
  );
}

function Container21() {
  return (
    <div className="content-stretch flex flex-col gap-[8px] h-[76px] items-start relative shrink-0 w-full" data-name="Container">
      <Container18 />
      <Container19 />
      <Container20 />
    </div>
  );
}

function Container22() {
  return (
    <div className="absolute bg-[rgba(0,0,0,0.4)] box-border content-stretch flex flex-col h-[110px] items-start left-[560px] pb-px pt-[17px] px-[25px] rounded-[14px] top-[25px] w-[200px]" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.2)] border-solid inset-0 pointer-events-none rounded-[14px]" />
      <Container21 />
    </div>
  );
}

function Container23() {
  return (
    <div className="[grid-area:1_/_1] relative rounded-[16px] shrink-0" data-name="Container">
      <div className="overflow-clip relative rounded-[inherit] size-full">
        <Container13 />
        <Container17 />
        <Container22 />
        <div className="absolute h-[338px] left-[50px] top-[107px] w-[478px]" data-name="image 1">
          <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgImage1} />
        </div>
        <div className="absolute h-[67px] left-[193px] top-[276px] w-[68px]" data-name="image 2">
          <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgImage2} />
        </div>
        <div className="absolute h-[67px] left-[261px] top-[254px] w-[68px]" data-name="image 3">
          <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgImage2} />
        </div>
        <div className="absolute h-[67px] left-[193px] top-[236px] w-[68px]" data-name="image 4">
          <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgImage2} />
        </div>
        <div className="absolute h-[67px] left-[255px] top-[310px] w-[68px]" data-name="image 5">
          <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={imgImage2} />
        </div>
      </div>
      <div aria-hidden="true" className="absolute border border-[rgba(255,255,255,0.1)] border-solid inset-0 pointer-events-none rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]" />
    </div>
  );
}

function PackagingMode4() {
  return (
    <div className="gap-[24px] grid grid-cols-[785px_minmax(0px,_1fr)] grid-rows-[repeat(1,_minmax(0px,_1fr))] h-[508px] relative shrink-0 w-[1229px]" data-name="PackagingMode">
      <Container12 />
      <Container23 />
    </div>
  );
}

function MainContent() {
  return (
    <div className="basis-0 grow min-h-px min-w-px relative shrink-0" data-name="Main Content">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid box-border content-stretch flex flex-col h-full items-start overflow-clip pb-0 pt-[24px] px-[24px] relative rounded-[inherit]">
        <PackagingMode4 />
      </div>
    </div>
  );
}

function Container24() {
  return (
    <div className="absolute content-stretch flex flex-col h-[663px] items-start left-0 top-0" data-name="Container">
      <Header />
      <MainContent />
    </div>
  );
}

export default function CargoFlightPreparationProcess() {
  return (
    <div className="relative size-full" data-name="Cargo Flight Preparation Process" style={{ backgroundImage: "linear-gradient(152.562deg, rgb(15, 23, 43) 0%, rgb(28, 57, 142) 50%, rgb(15, 23, 43) 100%), linear-gradient(90deg, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 100%)" }}>
      <Container3 />
      <Container24 />
    </div>
  );
}