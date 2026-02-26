import { supabase } from './supabase';

/**
 * =============================================
 * Stock Service — Sarpras Digital Attanwir
 * =============================================
 * Semua perubahan stok WAJIB melalui service ini.
 * Tidak boleh update stok langsung tanpa membuat log.
 * 
 * Tipe log:
 *   - in         : Barang masuk (dari pembelian)
 *   - out        : Barang keluar
 *   - adjustment : Penyesuaian stok manual
 *   - damage     : Pengurangan karena kerusakan
 * 
 * Reference type:
 *   - purchase : Dari transaksi belanja
 *   - damage   : Dari laporan kerusakan
 *   - manual   : Update stok manual
 */

/**
 * Update stok barang di inventory + insert log ke stock_logs.
 * 
 * @param {Object} params
 * @param {string} params.productId      - UUID inventory item
 * @param {string} params.type           - 'in' | 'out' | 'adjustment' | 'damage'
 * @param {number} params.quantity       - Jumlah perubahan (selalu positif)
 * @param {string} params.referenceType  - 'purchase' | 'damage' | 'manual'
 * @param {string} [params.referenceId]  - UUID referensi (transaction_id / damage_report_id)
 * @param {string} [params.notes]        - Catatan
 * @param {string} [params.userId]       - UUID user yang melakukan perubahan
 * @returns {Promise<{success: boolean, newStock: number, log: object, error: string|null}>}
 */
export async function updateStock({
  productId,
  type,
  quantity,
  referenceType,
  referenceId = null,
  notes = '',
  userId = null,
}) {
  try {
    // 1. Ambil stok saat ini
    const { data: product, error: fetchError } = await supabase
      .from('inventory')
      .select('id, stok_saat_ini, nama_barang')
      .eq('id', productId)
      .single();

    if (fetchError || !product) {
      throw new Error('Barang tidak ditemukan di inventaris');
    }

    // 2. Hitung stok baru
    let newStock;
    if (type === 'in') {
      newStock = product.stok_saat_ini + quantity;
    } else if (type === 'out' || type === 'damage') {
      newStock = product.stok_saat_ini - quantity;
    } else if (type === 'adjustment') {
      // Adjustment bisa positif atau negatif, quantity sudah signed
      newStock = product.stok_saat_ini + quantity;
    } else {
      throw new Error(`Tipe log tidak valid: ${type}`);
    }

    // 3. Validasi stok tidak negatif
    if (newStock < 0) {
      throw new Error(
        `Stok tidak mencukupi. Stok saat ini: ${product.stok_saat_ini}, perubahan: -${quantity}`
      );
    }

    // 4. Update stok di inventory
    const { error: updateError } = await supabase
      .from('inventory')
      .update({ stok_saat_ini: newStock })
      .eq('id', productId);

    if (updateError) throw updateError;

    // 5. Insert log ke stock_logs
    const { data: logData, error: logError } = await supabase
      .from('stock_logs')
      .insert([{
        product_id: productId,
        type,
        quantity,
        reference_type: referenceType,
        reference_id: referenceId || null,
        notes: notes || null,
        user_id: userId || null,
      }])
      .select()
      .single();

    if (logError) throw logError;

    // 6. Juga insert ke inventory_stock_log (backward compatibility)
    await supabase.from('inventory_stock_log').insert([{
      inventory_id: productId,
      perubahan: type === 'in' || type === 'adjustment' ? quantity : -quantity,
      stok_sebelum: product.stok_saat_ini,
      stok_sesudah: newStock,
      keterangan: notes || `${type} via stock service`,
      transaction_id: referenceType === 'purchase' ? referenceId : null,
    }]);

    return {
      success: true,
      newStock,
      log: logData,
      error: null,
    };
  } catch (err) {
    console.error('[StockService] Error:', err.message);
    return {
      success: false,
      newStock: null,
      log: null,
      error: err.message || 'Gagal update stok',
    };
  }
}

/**
 * Tambah stok dari pembelian (type: 'in', reference: 'purchase')
 * Jika barang belum ada di inventory, otomatis buat baru.
 * 
 * @param {Object} params
 * @param {string} params.namaBarang    - Nama barang
 * @param {number} params.jumlah        - Jumlah
 * @param {string} params.satuan        - Satuan
 * @param {string} params.kategori      - Kategori
 * @param {string} params.transactionId - UUID transaksi
 * @param {string} params.judulBelanja  - Judul belanja (untuk catatan)
 * @param {string} [params.userId]      - UUID user
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function addStockFromPurchase({
  namaBarang,
  jumlah,
  satuan,
  kategori,
  transactionId,
  judulBelanja,
  userId = null,
}) {
  try {
    // Cek apakah barang sudah ada di inventory
    const { data: existing } = await supabase
      .from('inventory')
      .select('id, stok_saat_ini')
      .eq('nama_barang', namaBarang)
      .maybeSingle();

    if (existing) {
      // Update stok barang yang sudah ada
      const result = await updateStock({
        productId: existing.id,
        type: 'in',
        quantity: jumlah,
        referenceType: 'purchase',
        referenceId: transactionId,
        notes: `Belanja: ${judulBelanja}`,
        userId,
      });

      if (!result.success) throw new Error(result.error);
    } else {
      // Buat inventory item baru
      const { data: newItem, error: createError } = await supabase
        .from('inventory')
        .insert([{
          nama_barang: namaBarang,
          kategori,
          stok_saat_ini: jumlah,
          satuan,
        }])
        .select()
        .single();

      if (createError) throw createError;

      // Insert log untuk barang baru
      await supabase.from('stock_logs').insert([{
        product_id: newItem.id,
        type: 'in',
        quantity: jumlah,
        reference_type: 'purchase',
        reference_id: transactionId,
        notes: `Belanja baru: ${judulBelanja}`,
        user_id: userId || null,
      }]);

      // Backward compatibility log
      await supabase.from('inventory_stock_log').insert([{
        inventory_id: newItem.id,
        perubahan: jumlah,
        stok_sebelum: 0,
        stok_sesudah: jumlah,
        keterangan: `Belanja baru: ${judulBelanja}`,
        transaction_id: transactionId,
      }]);
    }

    return { success: true, error: null };
  } catch (err) {
    console.error('[StockService] addStockFromPurchase error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Kurangi stok karena kerusakan (type: 'damage', reference: 'damage')
 * 
 * @param {Object} params
 * @param {string} params.productId      - UUID inventory item
 * @param {number} params.quantity       - Jumlah yang rusak
 * @param {string} params.damageReportId - UUID laporan kerusakan
 * @param {string} [params.notes]        - Catatan
 * @param {string} [params.userId]       - UUID user
 * @returns {Promise<{success: boolean, newStock: number|null, error: string|null}>}
 */
export async function reduceStockFromDamage({
  productId,
  quantity,
  damageReportId,
  notes = '',
  userId = null,
}) {
  return updateStock({
    productId,
    type: 'damage',
    quantity,
    referenceType: 'damage',
    referenceId: damageReportId,
    notes: notes || 'Pengurangan stok karena kerusakan',
    userId,
  });
}

/**
 * Update stok manual (type: 'adjustment', reference: 'manual')
 * 
 * @param {Object} params
 * @param {string} params.productId - UUID inventory item
 * @param {number} params.change    - Perubahan (positif = tambah, negatif = kurangi)
 * @param {string} [params.notes]   - Catatan
 * @param {string} [params.userId]  - UUID user
 * @returns {Promise<{success: boolean, newStock: number|null, error: string|null}>}
 */
export async function adjustStockManual({
  productId,
  change,
  notes = '',
  userId = null,
}) {
  return updateStock({
    productId,
    type: 'adjustment',
    quantity: change,
    referenceType: 'manual',
    notes: notes || (change > 0 ? 'Penambahan stok manual' : 'Pengurangan stok manual'),
    userId,
  });
}

/**
 * Ambil riwayat stok dengan filter
 * 
 * @param {Object} [filters]
 * @param {string} [filters.productId]   - Filter by product
 * @param {string} [filters.type]        - Filter by type
 * @param {string} [filters.startDate]   - Filter start date (YYYY-MM-DD)
 * @param {string} [filters.endDate]     - Filter end date (YYYY-MM-DD)
 * @param {number} [filters.limit]       - Limit results
 * @param {number} [filters.offset]      - Offset for pagination
 * @returns {Promise<{data: Array, count: number, error: string|null}>}
 */
export async function getStockLogs(filters = {}) {
  try {
    let query = supabase
      .from('stock_logs')
      .select(`
        *,
        inventory:product_id (
          id,
          nama_barang,
          satuan,
          kategori,
          stok_saat_ini
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.productId) {
      query = query.eq('product_id', filters.productId);
    }

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.startDate) {
      query = query.gte('created_at', `${filters.startDate}T00:00:00`);
    }

    if (filters.endDate) {
      query = query.lte('created_at', `${filters.endDate}T23:59:59`);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    return { data: data || [], count: count || 0, error: null };
  } catch (err) {
    console.error('[StockService] getStockLogs error:', err.message);
    return { data: [], count: 0, error: err.message };
  }
}
