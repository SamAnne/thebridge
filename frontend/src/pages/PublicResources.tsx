import { useState } from 'react';
import { useLoaderData, Link } from 'react-router-dom';
import type { PublicResource, PublicResourceFile } from './PublicResources.loader';
import './PublicResources.css';

function formatDate(value: string) {
    return new Date(value).toLocaleDateString();
}

function isPdf(fileName: string) {
    return fileName.toLowerCase().endsWith('.pdf');
}

// Word docs (.docx) have no working in-browser preview here - only PDFs get
// an inline toggle, since browsers render `application/pdf` natively in an
// iframe. The plain link still works for every file type either way.
function FileWithPreview({ file }: { file: PublicResourceFile }) {
    const [isOpen, setIsOpen] = useState(false);
    const previewable = isPdf(file.fileName);

    return (
        <div className="public-resources__file">
            <div className="public-resources__file-row">
                <a href={file.url} target="_blank" rel="noopener noreferrer">{file.fileName}</a>
                {previewable && (
                    <button
                        type="button"
                        className="public-resources__preview-toggle"
                        aria-expanded={isOpen}
                        onClick={() => setIsOpen(open => !open)}
                    >
                        {isOpen ? 'Hide preview' : 'Preview'}
                    </button>
                )}
            </div>
            {previewable && isOpen && (
                <iframe
                    className="public-resources__preview-frame"
                    src={`${file.url}#toolbar=0`}
                    title={`Preview of ${file.fileName}`}
                />
            )}
        </div>
    );
}

function PublicResources() {
    const { resources, error, filtered } = useLoaderData() as {
        resources: PublicResource[];
        error: string | null;
        filtered: boolean;
    };

    return (
        <div className="page">
            <div className="page__header">
                <div>
                    <p className="page__eyebrow">The Bridge</p>
                    <h1 className="page__title">Resources</h1>
                    <p className="page__subtitle">
                        {resources.length === 0
                            ? 'Published resources for students, families, and counselors.'
                            : `${resources.length} resource${resources.length === 1 ? '' : 's'} available`}
                    </p>
                </div>
                <div className="page__header-actions">
                    <Link className="btn btn--outline btn--small" to="/">Home</Link>
                </div>
            </div>

            {error && <p className="alert-error">{error}</p>}

            {!error && (
                resources.length === 0 ? (
                    <p className="empty-state">
                        {filtered ? 'No resources match the selected filters.' : 'No published resources yet. Check back soon.'}
                    </p>
                ) : (
                    <div className="public-resources__grid">
                        {resources.map(resource => {
                            const posted = formatDate(resource.date);
                            const updated = formatDate(resource.updatedAt);

                            return (
                                <div className="card public-resources__card" key={resource.id}>
                                    <p className="public-resources__description">{resource.description}</p>

                                    {(resource.counties.length > 0 || resource.districts.length > 0) && (
                                        <div className="public-resources__tags">
                                            {resource.counties.map(county => (
                                                <span className="tag-pill" key={`county-${county}`}>{county}</span>
                                            ))}
                                            {resource.districts.map(district => (
                                                <span className="tag-pill" key={`district-${district}`}>{district}</span>
                                            ))}
                                        </div>
                                    )}

                                    {resource.files.length > 0 && (
                                        <div className="public-resources__files">
                                            {resource.files.map(file => (
                                                <FileWithPreview key={file.id} file={file} />
                                            ))}
                                        </div>
                                    )}

                                    <p className="public-resources__date">
                                        Posted {posted}{updated !== posted ? ` · Updated ${updated}` : ''}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )
            )}
        </div>
    );
}

export default PublicResources;
