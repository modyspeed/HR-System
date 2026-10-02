import { useEffect, useState, type FormEvent } from "react";
import { Button, Input, Modal, Select } from "../../../components/ui";
import type { DepartmentRecord, EmployeeInput, EmployeeRecord } from "../../../core/api/contracts";
import { employeeFormSchema, formatEmployeeFormErrors, type EmployeeFormValues } from "../validation";

interface EmployeeFormModalProps {
  open: boolean;
  employee: EmployeeRecord | null;
  departments: DepartmentRecord[];
  onClose(): void;
  onSave(input: EmployeeInput): Promise<void>;
}

const blankValues: EmployeeFormValues = {
  code: "",
  fullName: "",
  departmentId: "",
  hireDate: "",
  jobTitle: "",
};

export function EmployeeFormModal({
  open,
  employee,
  departments,
  onClose,
  onSave,
}: EmployeeFormModalProps) {
  const [values, setValues] = useState<EmployeeFormValues>(blankValues);
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(employee ? {
      code: employee.code,
      fullName: employee.fullName,
      departmentId: String(employee.departmentId),
      hireDate: employee.hireDate,
      jobTitle: employee.jobTitle ?? "",
    } : blankValues);
    setErrors({});
    setFormError(null);
  }, [employee, open]);

  function updateValue(field: keyof EmployeeFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = employeeFormSchema.safeParse(values);
    if (!validation.success) {
      setErrors(formatEmployeeFormErrors(validation.error));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await onSave({
        ...validation.data,
        departmentId: Number(validation.data.departmentId),
        jobTitle: validation.data.jobTitle.trim(),
      });
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "تعذر حفظ بيانات الموظف.");
    } finally {
      setSaving(false);
    }
  }

  const departmentOptions = [
    { label: "اختر القسم", value: "" },
    ...departments.map((department) => ({ label: department.name, value: String(department.id) })),
  ];

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      title={employee ? "تعديل بيانات الموظف" : "موظف جديد"}
    >
      <form className="employee-form" noValidate onSubmit={submit}>
        <div className="employee-form-grid">
          <FormField error={errors.code} label="كود الموظف" required>
            <Input autoComplete="off" maxLength={50} onChange={(event) => updateValue("code", event.target.value)} value={values.code} />
          </FormField>
          <FormField error={errors.fullName} label="اسم الموظف" required>
            <Input autoComplete="name" maxLength={200} onChange={(event) => updateValue("fullName", event.target.value)} value={values.fullName} />
          </FormField>
          <FormField error={errors.departmentId} label="القسم" required>
            <Select onChange={(event) => updateValue("departmentId", event.target.value)} options={departmentOptions} value={values.departmentId} />
          </FormField>
          <FormField error={errors.hireDate} label="تاريخ التعيين" required>
            <Input max={new Date().toISOString().slice(0, 10)} onChange={(event) => updateValue("hireDate", event.target.value)} type="date" value={values.hireDate} />
          </FormField>
          <FormField error={errors.jobTitle} label="المسمى الوظيفي">
            <Input maxLength={160} onChange={(event) => updateValue("jobTitle", event.target.value)} value={values.jobTitle} />
          </FormField>
        </div>
        {formError && <p className="employee-form-error" role="alert">{formError}</p>}
        <div className="ui-dialog-actions">
          <Button disabled={saving} onClick={onClose} type="button">إلغاء</Button>
          <Button disabled={saving} type="submit" variant="primary">{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function FormField({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="employee-form-field">
      <span>{label}{required && <span aria-hidden="true" className="required-marker"> *</span>}</span>
      {children}
      {error && <small className="employee-field-error" role="alert">{error}</small>}
    </label>
  );
}