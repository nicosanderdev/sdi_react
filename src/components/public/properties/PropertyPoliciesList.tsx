import { Card } from 'flowbite-react';
import { pickPolicyDescription, pickPolicyTitle } from '../../../models/properties/propertyPolicies';
import type { PublicPropertyPolicy } from '../../../models/properties/PublicProperty';

interface PropertyPoliciesListProps {
  policies?: PublicPropertyPolicy[];
  locale?: string;
}

export function PropertyPoliciesList({ policies, locale = 'es' }: PropertyPoliciesListProps) {
  if (!policies?.length) return null;

  return (
    <Card className="mb-8 p-3">
      <h2 className="text-2xl font-bold mb-4">Políticas</h2>
      <div className="space-y-4">
        {policies.map((policy, index) => {
          const title = pickPolicyTitle(policy, locale);
          const description = pickPolicyDescription(policy, locale);
          if (!title && !description) return null;
          return (
            <div key={`${policy.templateKey ?? 'custom'}-${index}`}>
              {title && <h3 className="font-semibold text-lg">{title}</h3>}
              {description && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-line">{description}</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
