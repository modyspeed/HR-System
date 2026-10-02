import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button, Input, Modal } from "../../../components/ui";

const departmentSchema = z.string().trim().min(1, "اسم القسم مطلوب.").max(120, "اسم القسم طويل جدًا.");

interface DepartmentFormModalProps {
  open: boolean;
  onClose(): void;
  onSave(name: string): Promise<void>;
}

export function DepartmentFormModal({ open, onClose, onSave }: DepartmentFormModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = departmentSchema.safeParse(name);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "اسم القسم غير صحيح.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(validation.data);
      setName("");
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "تعذر إضافة القسم.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }} title="إضافة قسم">
      <form className="department-form" noValidate onSubmit={submit}>
        <label className="employee-form-field">
          <span>اسم القسم</span>
          <Input autoFocus maxLength={120} onChange={(event) => { setName(event.target.value); setError(null); }} value={name} />
          {error && <small className="employee-field-error" role="alert">{error}</small>}
        </label>
        <div className="ui-dialog-actions">
          <Button disabled={saving} onClick={onClose} type="button">إلغاء</Button>
          <Button disabled={saving} type="submit" variant="primary">{saving ? "جارٍ الحفظ..." : "إضافة القسم"}</Button>
        </div>
      </form>
    </Modal>
  );
}