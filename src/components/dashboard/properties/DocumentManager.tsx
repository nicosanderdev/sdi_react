import React, { useRef } from 'react';
import { FileDown, FileText, Trash2 } from 'lucide-react';
import { Button } from 'flowbite-react';

export interface DisplayDocument {
    key: string;
    title: string;
    fileName: string;
    source: 'existing' | 'new';
    file?: File;
    id?: string;
    url?: string;
}

interface DocumentManagerProps {
    displayDocuments: DisplayDocument[];
    onDocumentsChange: (documents: DisplayDocument[]) => void;
}

export const DocumentManager: React.FC<DocumentManagerProps> = ({
    displayDocuments,
    onDocumentsChange
}) => {
    const docFileInputRef = useRef<HTMLInputElement>(null);

    // --- Document Handlers ---
    const handleProcessDocs = (files: FileList | null) => {
        if (!files) return;
        const newFiles = Array.from(files);
        const newDisplayDocuments: DisplayDocument[] = newFiles.map(file => ({
            key: `${file.name}-${file.lastModified}`,
            title: file.name.split('.').slice(0, -1).join('.'),
            fileName: file.name,
            source: 'new',
            file: file
        }));
        onDocumentsChange([...displayDocuments, ...newDisplayDocuments]);
    };

    const handleDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => 
        handleProcessDocs(e.target.files);

    const handleDocDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        handleProcessDocs(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

    const handleDeleteDocument = (key: string) => {
        onDocumentsChange(displayDocuments.filter(doc => doc.key !== key));
    };

    const handleDocumentTitleChange = (key: string, newTitle: string) => {
        onDocumentsChange(displayDocuments.map(doc => 
            doc.key === key ? { ...doc, title: newTitle } : doc
        ));
    };

    return (
        <div className='p-4 md:p-6'>
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">Documentos</h3>
            
            <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 transition-colors"
                onDrop={handleDocDrop}
                onDragOver={handleDragOver}
                onClick={() => docFileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={docFileInputRef}
                    onChange={handleDocFileChange}
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                    className="hidden"
                />
                <div className="flex flex-col items-center">
                    <FileDown size={40} className="text-gray-400 mb-4" />
                    <p className="font-medium mb-2">Arrastra y suelta documentos aquí</p>
                    <p className="text-sm mb-4">o</p>
                    <Button 
                        onClick={(e) => { e.stopPropagation(); docFileInputRef.current?.click(); }}
                    >
                        Seleccionar archivos
                    </Button>
                </div>
            </div>

            {displayDocuments.length > 0 && (
                <div className="mt-6 space-y-3">
                    {displayDocuments.map((doc) => (
                        <div key={doc.key} className="flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                            <FileText className="w-6 h-6 text-[#1B4965] flex-shrink-0" />
                            <div className="flex-grow">
                                <input
                                    type="text"
                                    value={doc.title}
                                    onChange={(e) => handleDocumentTitleChange(doc.key, e.target.value)}
                                    placeholder="Título del documento"
                                    className="w-full text-sm font-medium text-gray-800 border-b border-transparent focus:outline-none focus:border-gray-300"
                                />
                                <p className="text-xs text-gray-500 mt-1">{doc.fileName}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleDeleteDocument(doc.key)}
                                className="p-2 text-red-500 hover:bg-red-100 rounded-full transition-colors"
                                title="Eliminar documento"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
