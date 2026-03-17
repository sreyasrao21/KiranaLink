import Dexie, { type Table } from 'dexie';

export interface Product {
  id?: number;
  _id?: string;
  name: string;
  price: number;
  stock: number;
  minStock: number;
  icon: string;
  category: string;
  unit: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Customer {
  _id?: string;
  id?: number;
  name?: string;
  phoneNumber: string;
  khataBalance: number;

  // AI Agent & Recovery Fields (HEAD)
  totalTransactions?: number;
  trustScore?: number;
  visitValidation?: number;
  lastVisit?: string | number;
  loyaltyPoints?: number;
  totalPurchases?: number;
  nextCallDate?: number;
  recoveryStatus?: 'Promised' | 'Call Again' | 'Busy' | 'Failed';
  recoveryNotes?: string;

  // Khata Logic Fields (Main)
  khataScore?: number;
  khataLimit?: number;
  activeKhataAmount?: number;
  maxHistoricalKhataAmount?: number;
  lastScoreUpdate?: number;
  khataTransactions?: number;
  latePayments?: number;
  lastPaymentDate?: number;
  createdAt?: number | string;
}

export interface Transaction {
  _id: string;
  paymentType: 'cash' | 'online' | 'ledger' | string;
  totalAmount: number;
  createdAt: string | number;
  customerId?: {
    phoneNumber: string;
    name?: string;
  };
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
}

export interface Deal {
  _id: string;
  groupName?: string;
  members?: any[];
  products: { productId: string | null; quantity: number }[];
  totalAmount: number;
  status: string;

  // Group Buy Fields
  location?: { lat: number; lng: number };
  anchorShop?: string;
  image_url?: string;
  expiresAt?: string | Date;
  dealPrice?: number;
  marketPrice?: number;
  currentUnits?: number;
  targetUnits?: number;
  aiInsight?: string;
  tiers?: Array<{ goal: number; price: number; label: string }>;
}

export interface LedgerEntry {
  id?: number;
  customerId: string; // Phone number or UUID
  amount: number;
  paymentMode: 'CASH' | 'UPI' | 'KHATA' | 'DEBIT' | 'CREDIT';
  type: 'debit' | 'credit';
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  createdAt: number;
  paidAt?: number;
  items?: any[];
}

export class GraminLinkDB extends Dexie {
  products!: Table<Product>;
  customers!: Table<Customer>;
  ledger!: Table<LedgerEntry>;

  constructor() {
    super('GraminLinkDB');
    this.version(3).stores({
      products: '++id, _id, name, category',
      customers: '++id, _id, phoneNumber, khataScore',
      ledger: '++id, customerId, paymentMode, status, createdAt'
    });
  }
}

export const db = new GraminLinkDB();
