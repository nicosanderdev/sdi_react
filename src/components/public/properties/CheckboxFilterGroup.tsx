import { Checkbox, Label, Sidebar, SidebarItemGroup } from "flowbite-react";
import React from "react";
import { FilterSectionTitle } from "./FilterSectionTitle";

type CheckboxFilterGroupProps = {
  title: React.ReactNode;
  options: { id: string; value: string; label: string }[];
};

export const CheckboxFilterGroup: React.FC<CheckboxFilterGroupProps> = ({ title, options }) => {
  return (
    <SidebarItemGroup className="mb-4 ps-4">
      <FilterSectionTitle>{title}</FilterSectionTitle>
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <div key={option.id} className="flex items-center gap-2">
            <Checkbox id={option.id} value={option.value} />
            <Label className="font-light" htmlFor={option.id}>
              {option.label}
            </Label>
          </div>
        ))}
      </div>
    </SidebarItemGroup>
  );
};