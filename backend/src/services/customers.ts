/** All SQL touching the customers table. */
import type { RowDataPacket } from 'mysql2/promise';
import { execute, query, queryOne } from '../db/pool.js';

export interface CustomerRow extends RowDataPacket {
  id: number;
  customer_name: string;
  is_regular: boolean;
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

export interface NewCustomer {
  customerName: string;
  isRegular: boolean;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  city: string | null;
  address: string | null;
  gstin: string | null;
}

const COLUMNS =
  'id, customer_name, is_regular, is_active, contact_person, phone, email, city, address, gstin, created_at, updated_at';

/** MySQL hands TINYINT(1) back as 1/0; the API promises real true/false values. */
function toCustomer(row: CustomerRow): CustomerRow {
  return { ...row, is_regular: Boolean(row.is_regular), is_active: Boolean(row.is_active) };
}

export async function listCustomers(): Promise<CustomerRow[]> {
  const rows = await query<CustomerRow>(`SELECT ${COLUMNS} FROM customers ORDER BY customer_name ASC`);
  return rows.map(toCustomer);
}

export async function findCustomerById(id: number): Promise<CustomerRow | null> {
  const row = await queryOne<CustomerRow>(`SELECT ${COLUMNS} FROM customers WHERE id = ?`, [id]);
  return row && toCustomer(row);
}

export async function createCustomer(customer: NewCustomer, createdBy: number | null): Promise<CustomerRow> {
  const result = await execute(
    `INSERT INTO customers (customer_name, is_regular, contact_person, phone, email, city, address, gstin, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customer.customerName,
      customer.isRegular,
      customer.contactPerson,
      customer.phone,
      customer.email,
      customer.city,
      customer.address,
      customer.gstin,
      createdBy,
    ],
  );

  const created = await findCustomerById(result.insertId);
  if (!created) {
    throw new Error(`Customer ${result.insertId} vanished immediately after insert`);
  }
  return created;
}

/** Replaces every editable field. Returns null when there is no such customer. */
export async function updateCustomer(id: number, customer: NewCustomer): Promise<CustomerRow | null> {
  await execute(
    `UPDATE customers
        SET customer_name = ?, is_regular = ?, contact_person = ?, phone = ?, email = ?, city = ?,
            address = ?, gstin = ?
      WHERE id = ?`,
    [
      customer.customerName,
      customer.isRegular,
      customer.contactPerson,
      customer.phone,
      customer.email,
      customer.city,
      customer.address,
      customer.gstin,
      id,
    ],
  );
  // Read it back rather than trust affectedRows, which is 0 both for a
  // missing id and for a save that changed nothing.
  return findCustomerById(id);
}

/** Marks a customer active or inactive. Returns null when there is no such customer. */
export async function setCustomerActive(id: number, isActive: boolean): Promise<CustomerRow | null> {
  await execute('UPDATE customers SET is_active = ? WHERE id = ?', [isActive, id]);
  return findCustomerById(id);
}
