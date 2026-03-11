import React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "../components/ui";

interface AdminReasonDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loadingLabel?: string;
  reason: string;
  error?: string | null;
  loading?: boolean;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export const AdminReasonDialog: React.FC<AdminReasonDialogProps> = ({
  open,
  title,
  description,
  confirmLabel,
  loadingLabel = "Saving...",
  reason,
  error,
  loading = false,
  onReasonChange,
  onConfirm,
  onOpenChange,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700" htmlFor="admin-reason">
            Reason
          </label>
          <Textarea
            id="admin-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Capture why this action is necessary."
            className="min-h-[120px] border-slate-200 bg-white text-sm text-slate-900"
          />
          <p className="text-[11px] text-slate-500">This reason becomes part of the admin audit trail.</p>
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading || !reason.trim()}>
            {loading ? loadingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
