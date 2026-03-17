import React, { useState, useEffect } from 'react';
import { Plus, Search, AlertTriangle, Edit2, X, Package, Tag, Archive, BarChart2, Hash, CalendarDays, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productApi, expiryApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { useTranslate } from '../../hooks/useTranslate';
import { useLanguage } from '../../contexts/LanguageContext';

interface Product {
  _id?: string;
  name: string;
  price: number;
  stock: number;
  minStock: number;
  category: string;
  icon: string;
  unit: string;
  expiryDate?: string;
}

const CATEGORIES = [
  'Grocery', 'Dairy', 'Bakery', 'Beverages', 'Snacks',
  'Fruits & Vegetables', 'Meat & Seafood', 'Frozen Foods',
  'Personal Care', 'Household', 'Stationery', 'Electronics', 'Other'
];

const UNITS = [
  { value: 'piece', label: 'Piece (pc)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'litre', label: 'Litre (L)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'ml', label: 'Millilitre (ml)' },
  { value: 'pack', label: 'Pack' },
  { value: 'dozen', label: 'Dozen' },
];

const ProductCard = React.memo(({ product, onEdit }: { product: Product, onEdit: (p: Product) => void }) => {
  return (
    <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md hover:border-green-100 transition-all group">
      <div className="flex justify-between items-start">
        <div className="flex gap-4">
          <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner uppercase font-black text-primary-green">
            {product.icon || (product.name ? product.name[0] : '📦')}
          </div>
          <div className="space-y-1">
            <div className="font-black text-gray-900 text-lg leading-tight">{product.name}</div>
            <div className="flex items-center gap-2">
              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{product.category}</span>
              <span className="text-[10px] text-gray-300 font-black tracking-widest">{product.unit.toUpperCase()}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onEdit(product)}
          className="p-2.5 bg-gray-50 text-gray-400 hover:text-primary-green hover:bg-green-50 rounded-xl transition-all"
        >
          <Edit2 size={18} />
        </button>
      </div>

      <div className="mt-5 flex justify-between items-end border-t border-gray-50 pt-4">
        <div>
          <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Price</div>
          <div className="text-2xl font-black text-primary-green">₹{product.price}<span className="text-sm text-gray-400 font-bold"> / {product.unit}</span></div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black text-gray-400 uppercase mb-1">Stock</div>
          <div className={`text-xl font-black ${product.stock <= product.minStock ? 'text-red-500' : 'text-gray-900'}`}>
            {product.stock} <span className="text-sm text-gray-400 font-bold">{product.unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

const FormField = ({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
      {icon && <span className="text-gray-300">{icon}</span>}
      {label}
    </label>
    {children}
  </div>
);

const inputClass = "w-full bg-gray-50 border-2 border-transparent py-3 px-4 rounded-2xl font-bold text-gray-900 text-sm focus:border-primary-green focus:bg-white outline-none transition-all placeholder-gray-300";

export const ProductPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const { t } = useLanguage();
  const translatedProducts = useTranslate(products, ['name', 'category']);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<Product & { expiryDate: string }>({
    name: '', price: 0, stock: 0, minStock: 5, category: '', icon: '📦', unit: 'piece', expiryDate: ''
  });

  const loadProducts = React.useCallback(async () => {
    try {
      const response = await productApi.getAll();
      setProducts(response.data);
    } catch (err) {
      console.error('Failed to load products', err);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSave = React.useCallback(async () => {
    if (!formData.name || formData.price <= 0 || formData.stock < 0) {
      addToast('Please fill all fields correctly', 'error');
      return;
    }

    try {
      if (editingId) {
        await productApi.update(editingId, formData as any);
        addToast('Product updated successfully', 'success');
      } else {
        // Create product first
        const productResponse = await productApi.create(formData as any);
        const productId = productResponse.data._id;
        
        // If expiry date is provided, create an inventory batch with expiry
        if (formData.expiryDate) {
          try {
            await expiryApi.createBatch({
              productId: productId,
              quantity: formData.stock,
              costPricePerUnit: formData.price * 0.7, // Assume 70% of selling price as cost
              sellingPriceSnapshot: formData.price,
              expiryDate: formData.expiryDate,
            });
            addToast('Product added with expiry tracking!', 'success');
          } catch (batchErr) {
            console.error('Failed to create batch:', batchErr);
            addToast('Product added but failed to create expiry batch', 'error');
          }
        } else {
          addToast('Product added successfully', 'success');
        }
      }
      setFormData({ name: '', price: 0, stock: 0, minStock: 5, category: '', icon: '📦', unit: 'piece', expiryDate: '' });
      setEditingId(null);
      setShowForm(false);
      loadProducts();
    } catch (err) {
      console.error('Failed to save product', err);
      addToast('Failed to save product', 'error');
    }
  }, [formData, editingId, addToast, loadProducts]);

  const startEdit = React.useCallback((product: Product) => {
    setEditingId(product._id!);
    setFormData({
      name: product.name,
      price: product.price,
      stock: product.stock,
      minStock: product.minStock,
      category: product.category,
      icon: product.icon,
      unit: product.unit,
      expiryDate: product.expiryDate || '',
    });
    setShowForm(true);
  }, []);

  const filteredProducts = React.useMemo(() => {
    return translatedProducts.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [translatedProducts, searchTerm]);

  const lowStockProducts = React.useMemo(() => {
    return products.filter(p => p.stock <= p.minStock);
  }, [products]);

  const set = (field: keyof typeof formData, value: any) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-48">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900">{t['Products']}</h2>
          <p className="text-gray-500 text-sm font-medium">{t['Manage prices, stock, and categories'] || 'Manage prices, stock, and categories'}</p>
        </div>
        <button
          onClick={() => navigate('/supplier-bills')}
          className="bg-primary-green text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold shadow-lg shadow-green-200 hover:brightness-105 hover:scale-105 transition-all active:scale-95"
        >
          <Plus size={20} /> Add Product
        </button>
      </div>

      {/* Search + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border-2 border-gray-100 py-4 px-12 rounded-2xl text-base font-bold text-gray-900 outline-none focus:border-primary-green transition-all shadow-sm"
          />
        </div>
        <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase">Total Items</div>
            <div className="text-2xl font-black text-gray-900">{products.length}</div>
          </div>
          <Archive className="text-gray-200" size={32} />
        </div>
      </div>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="text-red-500 mt-0.5 shrink-0" size={20} />
          <div>
            <div className="font-black text-red-900">Low Stock Alert!</div>
            <div className="text-sm text-red-700 font-medium mt-0.5">
              {lowStockProducts.length} item{lowStockProducts.length > 1 ? 's are' : ' is'} below minimum capacity. Reorder soon.
            </div>
          </div>
        </div>
      )}

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProducts.map((product) => (
          <ProductCard key={product._id} product={product} onEdit={startEdit} />
        ))}
        {filteredProducts.length === 0 && (
          <div className="md:col-span-2 text-center py-20 text-gray-400">
            <Archive size={48} className="mx-auto mb-4 opacity-30" />
            <p className="font-bold">No products found</p>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 pt-7 pb-5 border-b border-gray-100">
              <div>
                <h3 className="text-2xl font-black text-gray-900">{editingId ? 'Edit Product' : 'New Product'}</h3>
                <p className="text-gray-400 text-sm mt-0.5">{editingId ? 'Update product details' : 'Add a new item to your shop inventory'}</p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-400 transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto px-8 py-6 space-y-5 flex-1">
              {/* Product Name */}
              <FormField label="Product Name" icon={<Package size={14} />}>
                <div className="relative">
                  <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                  <input
                    type="text"
                    placeholder="e.g. Basmati Rice"
                    value={formData.name}
                    onChange={(e) => set('name', e.target.value)}
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </FormField>

              {/* Price & Stock */}
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Price (₹)" icon={<Tag size={14} />}>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={formData.price}
                      onChange={(e) => set('price', Number(e.target.value))}
                      className={`${inputClass} pl-8`}
                    />
                  </div>
                </FormField>
                <FormField label="Stock Count" icon={<BarChart2 size={14} />}>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => set('stock', Number(e.target.value))}
                    className={inputClass}
                  />
                </FormField>
              </div>

              {/* Min Stock & Unit */}
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Minimum Stock" icon={<Hash size={14} />}>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => set('minStock', Number(e.target.value))}
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Unit" icon={<Layers size={14} />}>
                  <select
                    value={formData.unit}
                    onChange={(e) => set('unit', e.target.value)}
                    className={inputClass}
                  >
                    {UNITS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              {/* Category */}
              <FormField label="Category">
                <select
                  value={formData.category}
                  onChange={(e) => set('category', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select a category...</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </FormField>

              {/* Expiry Date */}
              <FormField label="Expiry Date (optional)" icon={<CalendarDays size={14} />}>
                <div className="relative">
                  <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => set('expiryDate', e.target.value)}
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </FormField>
            </div>

            {/* Modal Footer */}
            <div className="px-8 pb-7 pt-4 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3.5 rounded-2xl font-black text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-[2] bg-primary-green text-white py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-green-200 hover:brightness-105 active:scale-95 transition-all"
              >
                {editingId ? 'Update Product' : 'Add to Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

