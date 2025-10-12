export const PurchaseSchema = {
  name: "Purchase",
  type: "object",
  properties: {
    user_email: { type: "string", description: "Buyer email" },
    item_type: {
      type: "string",
      enum: ["album", "video", "song"],
      description: "Type of purchased item",
    },
    item_id: { type: "string", description: "ID of the purchased album or video" },
    item_title: { type: "string", description: "Title of purchased item" },
    amount: { type: "number", description: "Purchase amount in GHS" },
    payment_status: {
      type: "string",
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    payment_reference: { type: "string", description: "Paystack payment reference" },
    payment_method: {
      type: "string",
      enum: ["card", "mobile_money"],
      description: "Payment method used",
    },
  },
  required: ["user_email", "item_type", "item_id", "item_title", "amount"],
};

export const Purchase = {
  async create(payload) {
    const res = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create purchase');
    return res.json();
  },
  async filter(params = {}) {
    // Attach auth token if available and default to querying "me" when authenticated
    const token = localStorage.getItem('token');
    const hasIdentityParam = Object.prototype.hasOwnProperty.call(params, 'me') ||
      Object.prototype.hasOwnProperty.call(params, 'user_id');
    const finalParams = { ...params };
    if (token && !hasIdentityParam) {
      finalParams.me = 'true';
    }
    const q = new URLSearchParams(finalParams).toString();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const res = await fetch(`/api/purchases?${q}`, { headers });
    if (!res.ok) return [];
    return res.json();
  },
  async verify(reference) {
    const res = await fetch(`/api/paystack/verify/${encodeURIComponent(reference)}`);
    if (!res.ok) throw new Error('Verification failed');
    return res.json();
  },
  async initializePayment(payload) {
    const res = await fetch('/api/paystack/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Payment initialization failed');
    return res.json();
  },
};

export default PurchaseSchema;