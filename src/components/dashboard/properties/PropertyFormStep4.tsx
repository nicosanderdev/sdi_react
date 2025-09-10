import React from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { PlusIcon, TrashIcon, FileTextIcon } from 'lucide-react';
import { PropertyFormData } from './AddPropertyForm';
import { Button, FileInput, Label } from 'flowbite-react';

interface PropertyFormStep4Props {
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

const DocumentUploadField = ({ name, label, register, error }: { name: keyof PropertyFormData, label: string, register: any, error?: any }) => (
  <div className="p-4 border border-primary-500 dark:border-gray-300 rounded-lg">
    <div className="mb-3 block">
        <Label htmlFor={name}>{label}</Label>
    </div>
    <div className="flex items-center space-x-4">
      <FileTextIcon className="" size={24} />
      <FileInput id={name} 
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" 
        {...register(name)}
        color="alternative" />
      {/* <Button
        id={name}
        color="alternative"
        size="sm"
        pill
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        {...register(name)}>
        Seleccionar archivo
      </Button> */}
    </div>
    {error && <p className="text-red-500 text-sm mt-1">{error.message}</p>}
  </div>
);

export function PropertyFormStep4({ onSubmit, onBack }: PropertyFormStep4Props) {
  const { control, register, formState: { errors, isSubmitting } } = useFormContext<PropertyFormData>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'otherDocuments',
  });

  return (
    <form onSubmit={onSubmit} className="max-w-2xl mx-auto">
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-[#101828]">Documentación (Opcional)</h2>
          <p className="text-sm text-gray-500 mt-1">Adjunta documentos relevantes para la propiedad. Los formatos aceptados son PDF, DOC, DOCX, JPG, PNG.</p>
        </div>

        <div className="space-y-4">
          <DocumentUploadField name="publicDeed" label="Escritura Pública" register={register} error={errors.publicDeed} />
          <DocumentUploadField name="propertyPlans" label="Planos de la Propiedad Aprobados" register={register} error={errors.propertyPlans} />
          <DocumentUploadField name="taxReceipts" label="Recibos de Impuestos al día" register={register} error={errors.taxReceipts} />
        </div>

        <div>
          <h3 className="text-md font-semibold">Otros Documentos</h3>
          <div className="space-y-4 mt-2">
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border border-gray-200 rounded-lg flex items-center space-x-4">
                <div className="flex-grow">
                  <label htmlFor={`doc-name-${index}`} className="sr-only">Nombre del Documento</label>
                  <input
                    id={`doc-name-${index}`}
                    {...register(`otherDocuments.${index}.name`)}
                    placeholder="Nombre del documento"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#62B6CB] mb-2"
                  />
                  {errors.otherDocuments?.[index]?.name && <p className="text-red-500 text-sm">{errors.otherDocuments[index]?.name?.message}</p>}
                  
                  <label htmlFor={`doc-file-${index}`} className="sr-only">Archivo del Documento</label>
                  <input
                    id={`doc-file-${index}`}
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    {...register(`otherDocuments.${index}.file`)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#BEE9E8] file:text-[#1B4965] hover:file:bg-[#a8dad9]"
                  />
                  {errors.otherDocuments?.[index]?.file && <p className="text-red-500 text-sm mt-1">{errors.otherDocuments[index]?.file?.message}</p>}
                </div>
                <button type="button" onClick={() => remove(index)} className="p-2 text-red-500 hover:bg-red-100 rounded-full">
                  <TrashIcon size={20} />
                </button>
              </div>
            ))}
          </div>
          <Button
            color="alternative"
            type="button"
            onClick={() => append({ name: '', file: null as any })}>
            <PlusIcon size={16} className="mr-2" />
            Añadir otro documento
          </Button>
        </div>

        <div className="flex justify-between pt-4">
          <Button color="alternative" onClick={onBack}>
            Atrás
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : 'Guardar Propiedad'}
          </Button>
        </div>
      </div>
    </form>
  );
}