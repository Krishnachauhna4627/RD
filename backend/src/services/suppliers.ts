/** All SQL touching the suppliers table. */
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, queryOne } from '../db/pool.js';

export interface SupplierRow extends RowDataPacket {
  id: number;
  supplier_name: string;
  is_active: boolean;
  contact_person: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  address: string | null;
  gstin: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewSupplier {
  supplierName: string;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  address: string | null;
  gstin: string | null;
}

const COLUMNS =
  'id, supplier_name, is_active, contact_person, phone, email, city, address, gstin, created_at, updated_at';

/** MySQL hands TINYINT(1) back as 1/0; the API promises real true/false values. */
function toSupplier(row: SupplierRow): SupplierRow {
  return { ...row, is_active: Boolean(row.is_active) };
}

export async function listSuppliers(): Promise<SupplierRow[]> {
  const rows = await query<SupplierRow>(`SELECT ${COLUMNS} FROM suppliers ORDER BY supplier_name ASC`);
  return rows.map(toSupplier);
}

export async function findSupplierById(id: number): Promise<SupplierRow | null> {
  const row = await queryOne<SupplierRow>(`SELECT ${COLUMNS} FROM suppliers WHERE id = ?`, [id]);
  return row && toSupplier(row);
}

export async function createSupplier(supplier: NewSupplier, createdBy: number | null): Promise<SupplierRow> {
  const result = await execute(
    `INSERT INTO suppliers (supplier_name, contact_person, phone, email, city, address, gstin, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      supplier.supplierName,
      supplier.contactPerson,
      supplier.phone,
      supplier.email,
      supplier.city,
      supplier.address,
      supplier.gstin,
      createdBy,
    ],
  );

  const created = await findSupplierById(result.insertId);
  if (!created) {
    throw new Error(`Supplier ${result.insertId} vanished immediately after insert`);
  }
  return created;
}

/** Replaces every editable field. Returns null when there is no such supplier. */
export async function updateSupplier(id: number, supplier: NewSupplier): Promise<SupplierRow | null> {
  await execute(
    `UPDATE suppliers
        SET supplier_name = ?, contact_person = ?, phone = ?, email = ?, city = ?, address = ?, gstin = ?
      WHERE id = ?`,
    [
      supplier.supplierName,
      supplier.contactPerson,
      supplier.phone,
      supplier.email,
      supplier.city,
      supplier.address,
      supplier.gstin,
      id,
    ],
  );
  // Read it back rather than trust affectedRows, which is 0 both for a
  // missing id and for a save that changed nothing.
  return findSupplierById(id);
}

/** Marks a supplier active or inactive. Returns null when there is no such supplier. */
export async function setSupplierActive(id: number, isActive: boolean): Promise<SupplierRow | null> {
  await execute('UPDATE suppliers SET is_active = ? WHERE id = ?', [isActive, id]);
  return findSupplierById(id);
}
