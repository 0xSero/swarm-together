import { useState } from 'react'
import { File, FileText, Image, Code, Download, Eye, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Attachment, AttachmentType } from '@/types/blocks'

interface AttachmentViewerProps {
  attachments: Attachment[]
  onOpen?: (attachment: Attachment) => void
  onDownload?: (attachment: Attachment) => void
}

export function AttachmentViewer({ attachments, onOpen, onDownload }: AttachmentViewerProps) {
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)

  const getAttachmentIcon = (type: AttachmentType) => {
    const iconMap = {
      file: File,
      diff: FileText,
      log: FileText,
      image: Image,
      code: Code,
    }

    const Icon = iconMap[type] || File
    return <Icon className="w-4 h-4" />
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleOpen = (attachment: Attachment) => {
    if (onOpen) {
      onOpen(attachment)
    } else {
      setPreviewAttachment(attachment)
    }
  }

  const handleDownload = (attachment: Attachment, e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDownload) {
      onDownload(attachment)
    } else {
      // Default download behavior
      console.log('Download attachment:', attachment)
    }
  }

  return (
    <div className="space-y-2">
      <h5 className="text-xs font-semibold text-text-muted">
        Attachments ({attachments.length})
      </h5>

      <div className="space-y-1">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center gap-2 p-2 rounded bg-elevated/50 hover:bg-elevated transition-colors cursor-pointer group"
            onClick={() => handleOpen(attachment)}
          >
            <div className="text-text-muted">
              {getAttachmentIcon(attachment.attachment_type)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">
                {attachment.filename || 'Unnamed attachment'}
              </div>
              <div className="text-xs text-text-muted flex items-center gap-2">
                <span className="capitalize">{attachment.attachment_type}</span>
                <span>•</span>
                <span>{formatFileSize(attachment.size_bytes)}</span>
                {attachment.metadata?.lines && (
                  <>
                    <span>•</span>
                    <span>{attachment.metadata.lines} lines</span>
                  </>
                )}
                {attachment.metadata?.additions !== undefined && (
                  <>
                    <span className="text-success">
                      +{attachment.metadata.additions}
                    </span>
                    <span className="text-danger">
                      -{attachment.metadata.deletions}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                title="Preview"
              >
                <Eye className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => handleDownload(attachment, e)}
                className="h-6 w-6 p-0"
                title="Download"
              >
                <Download className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewAttachment && (
        <AttachmentPreviewModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      )}
    </div>
  )
}

interface AttachmentPreviewModalProps {
  attachment: Attachment
  onClose: () => void
}

function AttachmentPreviewModal({ attachment, onClose }: AttachmentPreviewModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg shadow-xl max-w-4xl max-h-[80vh] w-full mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">
              {attachment.filename || 'Attachment Preview'}
            </h3>
            <span className="text-xs text-text-muted capitalize">
              ({attachment.attachment_type})
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {attachment.attachment_type === 'image' ? (
            <img
              src={attachment.storage_path}
              alt={attachment.filename || 'Attachment'}
              className="max-w-full h-auto"
            />
          ) : attachment.metadata?.preview ? (
            <pre className="font-mono text-sm whitespace-pre-wrap">
              {attachment.metadata.preview}
            </pre>
          ) : (
            <div className="text-center text-text-muted py-8">
              <p>Preview not available</p>
              <p className="text-xs mt-2">
                Path: {attachment.storage_path}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border text-xs text-text-muted">
          <span>Size: {formatFileSize(attachment.size_bytes)}</span>
          {attachment.content_type && (
            <span>Type: {attachment.content_type}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
