/* ====== Utilities ====== */
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const CART_KEY = "ogb_cart_v1";

const money = n => "GHS " + Number(n).toFixed(2);

/* ====== Cart State ====== */
function loadCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}

function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  renderCartBadge();
}

function renderCartBadge() {
  const count = loadCart().reduce((a, i) => a + i.qty, 0);
  const cartCount = $("#cartCount");
  if (cartCount) cartCount.textContent = count;
}

function addToCart(name, price, img) {
  const items = loadCart();
  const idx = items.findIndex(i => i.name === name);
  if (idx > -1) { items[idx].qty += 1; }
  else { items.push({ name, price, img, qty: 1 }); }
  saveCart(items);
  // little toast
  const btn = event.currentTarget;
  btn.textContent = "Added ✓";
  setTimeout(() => btn.textContent = "Add to Cart", 900);
}

function renderCartList() {
  const box = $("#cartList");
  const items = loadCart();
  if (!box) return;
  if (items.length === 0) {
    box.innerHTML = "<p>Your cart is empty.</p>";
    $("#subtotal").textContent = money(0);
    return;
  }
  box.innerHTML = "";
  let total = 0;
  items.forEach((it, i) => {
    total += it.price * it.qty;
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <img src="${it.img}" alt="">
      <div>
        <div style="font-weight:700">${it.name}</div>
        <div class="price">${money(it.price)}</div>
      </div>
      <div>
        <div class="qty">
          <button onclick="chgQty(${i},-1)">−</button>
          <span>${it.qty}</span>
          <button onclick="chgQty(${i},1)">+</button>
        </div>
        <div style="text-align:right;margin-top:6px;"><a href="#" onclick="rmItem(${i});return false;">Remove</a></div>
      </div>`;
    box.appendChild(row);
  });
  $("#subtotal").textContent = money(total);
}

function chgQty(index, delta) {
  const items = loadCart();
  items[index].qty += delta;
  if (items[index].qty <= 0) items.splice(index, 1);
  saveCart(items);
  renderCartList();
  if (window.location.pathname.includes("checkout.html")) renderOrderSummary();
}

function rmItem(index) {
  const items = loadCart();
  items.splice(index, 1);
  saveCart(items);
  renderCartList();
  if (window.location.pathname.includes("checkout.html")) renderOrderSummary();
}

/* ====== Checkout Flow ====== */
function renderOrderSummary() {
  const items = loadCart();
  const box = $("#orderSummary");
  if (!box) return;
  if (items.length === 0) {
    box.innerHTML = "<b>No items in cart.</b>";
    return;
  }
  let total = 0;
  let html = "<b>Order Summary</b><ul style='margin:8px 0;padding-left:18px'>";
  items.forEach(it => {
    const line = it.price * it.qty;
    total += line;
    html += `<li>${it.name} × ${it.qty} — ${money(line)}</li>`;
  });
  html += `</ul><div style="display:flex;justify-content:space-between;font-weight:800">
            <span>Total</span><span>${money(total)}</span></div>`;
  box.innerHTML = html;
}

/* ====== Place Order ====== */
async function submitOrder(e) {
  e.preventDefault();
  const items = loadCart();
  if (items.length === 0) {
    alert("Your cart is empty.");
    return false;
  }

  const order = {
    id: "OGB" + Date.now(),
    name: $("#name").value.trim(),
    phone: $("#phone").value.trim(),
    email: $("#email").value.trim(),
    address: $("#address").value.trim(),
    items,
    total: items.reduce((a, i) => a + i.price * i.qty, 0),
    payMethod: document.querySelector('input[name="pay"]:checked').value,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  if (order.payMethod === "paystack") {
    payWithPaystack(order);
  } else {
    completeOrder(order); // Pay on delivery
  }
  return false;
}

function completeOrder(order) {
  // TODO: send to Firebase here if you want (replace with your Firestore call)
  // Example Firestore usage (pseudo):
  // await db.collection("orders").doc(order.id).set(order);

  localStorage.removeItem(CART_KEY);
  renderCartBadge();
  $("#successBox").style.display = "block";
  $("#successBox").innerHTML = `✅ Order placed!<br>Order ID: <b>${order.id}</b><br>Status: <b>${order.status}</b>`;
  renderOrderSummary(); // refresh summary to reflect cleared cart
}

function payWithPaystack(order) {
  const handler = PaystackPop.setup({
    key: "YOUR_PAYSTACK_PUBLIC_KEY_HERE", // ← replace with your Paystack public key
    email: order.email || "noemail@ongodbend.com",
    amount: Math.round(order.total * 100), // pesewas
    currency: "GHS",
    ref: order.id,
    callback: function (response) {
      order.status = "paid";
      completeOrder(order);
    },
    onClose: function () {
      alert("Payment cancelled.");
    }
  });
  handler.openIframe();
}

/* ====== Initialize ====== */
document.addEventListener("DOMContentLoaded", () => {
  renderCartBadge();
  if (window.location.pathname.includes("cart.html")) renderCartList();
  if (window.location.pathname.includes("checkout.html")) renderOrderSummary();
});