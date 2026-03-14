import { Label, Radio, Sidebar, SidebarItemGroup } from "flowbite-react";
import { FilterSectionTitle } from "./FilterSectionTitle";

interface RadioFilterOption {
  id: string;
  value: string;
  label: string;
}

interface RadioFilterGroupProps {
  title: string;
  name: string;
  options: RadioFilterOption[];
  layout?: 'vertical' | 'horizontal';
}

export const RadioFilterGroup: React.FC<RadioFilterGroupProps> = ({ title, name, options, layout = 'vertical' }) => {
  // Determine container classes based on the layout prop
  const containerClasses = layout === 'horizontal'
    ? 'flex items-center justify-center gap-4'
    : 'flex flex-col gap-2';
  
  // Use <legend> for better accessibility with radio groups
  const TitleComponent = layout === 'horizontal' ? 'legend' : FilterSectionTitle;
  const titleClasses = layout === 'horizontal' ? 'text-lg font-light mb-2' : '';


  return (
    <SidebarItemGroup className="mb-4 ps-4">
      <TitleComponent className={titleClasses}>{title}</TitleComponent>
      <div className={containerClasses}>
        {options.map((option) => (
          <div key={option.id} className="flex items-center gap-2">
            <Radio id={option.id} name={name} value={option.value} />
            <Label className="font-light" htmlFor={option.id}>{option.label}</Label>
          </div>
        ))}
      </div>
    </SidebarItemGroup>
  );
};