import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, FileUp, Download, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SharedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedBy: string;
  timestamp: number;
  data: string;
}

interface FileSharingProps {
  onClose: () => void;
  participantName: string;
  onFileShare: (file: SharedFile) => void;
  sharedFiles: SharedFile[];
}

export function FileSharing({ onClose, participantName, onFileShare, sharedFiles }: FileSharingProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 5MB (expands to ~7MB when encoded)",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = () => {
        const sharedFile: SharedFile = {
          id: Math.random().toString(36).substring(7),
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedBy: participantName,
          timestamp: Date.now(),
          data: reader.result as string,
        };

        onFileShare(sharedFile);

        toast({
          title: "File Shared",
          description: `${file.name} has been shared with participants`,
        });
      };

      reader.onerror = () => {
        toast({
          title: "Upload Failed",
          description: "Failed to read the file",
          variant: "destructive",
        });
      };

      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "An error occurred while uploading the file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownload = (file: SharedFile) => {
    const link = document.createElement("a");
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Started",
      description: `Downloading ${file.name}`,
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="w-96 border-l bg-card flex flex-col" data-testid="file-sharing-panel">
      <div className="h-16 border-b flex items-center justify-between px-4">
        <h2 className="font-semibold">Shared Files</h2>
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-files">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="p-4 border-b">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="input-file-upload"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
          disabled={isUploading}
          data-testid="button-select-file"
        >
          <FileUp className="w-4 h-4 mr-2" />
          {isUploading ? "Uploading..." : "Share File"}
        </Button>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Maximum file size: 5MB
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {sharedFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <File className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No files shared yet</p>
              <p className="text-xs mt-1">Upload a file to share with participants</p>
            </div>
          ) : (
            sharedFiles.map((file) => (
              <div
                key={file.id}
                className="p-3 border rounded-lg hover-elevate transition-all space-y-2"
                data-testid={`shared-file-${file.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate" title={file.name}>
                      {file.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDownload(file)}
                    className="shrink-0"
                    data-testid={`button-download-${file.id}`}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>{file.uploadedBy}</span>
                  <span>{formatTimestamp(file.timestamp)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
