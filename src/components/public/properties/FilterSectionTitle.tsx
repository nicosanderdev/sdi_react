export const FilterSectionTitle: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return (
    <h3 className="text-lg font-light mb-2">
      {children}
    </h3>
  );
};