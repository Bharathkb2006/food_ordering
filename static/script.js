/* ---------- Helper: fetch JSON ---------- */
async function getJSON(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

/* ---------- App state ---------- */
let allFoods = [];
let currentFilter = "All";

/* ---------- Cart (localStorage) ---------- */
function loadCart() { 
  return JSON.parse(localStorage.getItem("cart") || "{}"); 
}
function saveCart(cart) { 
  localStorage.setItem("cart", JSON.stringify(cart)); 
  updateCartCount(); 
}
function updateCartCount() {
  const cart = loadCart();
  let qty = 0;
  for (let k in cart) qty += cart[k];
  const el = document.getElementById("cart-count");
  if (el) el.textContent = qty;
}

/* ---------- Toggle add-to-cart button ---------- */
function toggleCartButton(btn, id, name, price) {
  const cart = loadCart();
  id = String(id); // ensure string key
  if (cart[id]) {
    // remove from cart
    delete cart[id];
    btn.textContent = "Add to Cart";
    btn.classList.remove("added");
  } else {
    // add to cart
    cart[id] = 1;
    btn.textContent = "Added to Cart";
    btn.classList.add("added");
  }
  saveCart(cart);
  renderCartPanel();
  renderCartDisplay();
}

/* ---------- Load & render foods ---------- */
async function loadFoods() {
  allFoods = await getJSON('/api/foods');
  renderItems();
  if (typeof populateReviewFoodSelect === "function") populateReviewFoodSelect();
  renderCartDisplay();
  renderCartPanel();
}

function filterBy(cat) {
  currentFilter = cat;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  const chip = document.getElementById('chip-' + cat);
  if (chip) chip.classList.add('active');
  renderItems();
}

// ---------- Render items (updated to accept optional list) ----------
function renderItems(list = null) {
  const container = document.getElementById('items');
  if (!container) return;

  container.innerHTML = ''; // clear existing items
  const cart = loadCart();

  // use filtered list if provided, otherwise normal filter
  const items = list || allFoods.filter(f => currentFilter === 'All' || f.category === currentFilter);

  items.forEach(f => {
    const inCart = cart[f.id];

    const div = document.createElement('div');
    div.className = 'food-card';

    div.innerHTML = `
      <img src="/static/images/${f.image}" alt="${escapeHtml(f.name)}">
      <div class="food-info">
        <h3>${escapeHtml(f.name)}</h3>
        <p class="muted">${escapeHtml(f.description || '')}</p>
        <p class="price">₹${f.price} • ${f.category}</p>
        <button class="add-to-cart ${inCart ? 'added' : ''}" 
          onclick="toggleCartButton(this, ${f.id}, '${escapeJs(f.name)}', ${f.price})">
          ${inCart ? 'Added to Cart' : 'Add to Cart'}
        </button>
      </div>
    `;

    container.appendChild(div);
  });
}



/* ---------- Cart panel & display ---------- */
function openCart() { document.getElementById('cart-panel').style.display = 'block'; }
function closeCart() { document.getElementById('cart-panel').style.display = 'none'; }

function renderCartPanel() {
  const container = document.getElementById('cart-items');
  const summary = document.getElementById('cart-summary');
  if (!container || !summary) return;
  const cart = loadCart();
  container.innerHTML = '';
  let total = 0;
  if (Object.keys(cart).length === 0) {
    container.innerHTML = '<p class="muted">Cart is empty.</p>';
    summary.innerHTML = `<strong>Total: ₹0</strong>`;
    return;
  }
  for (const id in cart) {
    const qty = cart[id];
    const food = allFoods.find(x => x.id == id);
    if (!food) continue;
    const line = document.createElement('div');
    line.className = 'cart-line';
    line.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between">
        <div>
          <strong>${escapeHtml(food.name)}</strong>
          <div class="muted">₹${food.price} × ${qty}</div>
        </div>
        <div>
          <button class="btn-secondary" onclick="reduceFromCart(${food.id})">−</button>
          <button class="btn-secondary" onclick="addToCart(${food.id})">+</button>
          <button class="btn-secondary" onclick="removeFromCart(${food.id})">Remove</button>
        </div>
      </div>
    `;
    container.appendChild(line);
    total += food.price * qty;
  }
  summary.innerHTML = `<strong>Total: ₹${total}</strong>`;
  updateCartCount();
}

function renderCartDisplay() {
  const container = document.getElementById('cart-display');
  if (!container) return;
  const cart = loadCart();
  if (Object.keys(cart).length === 0) {
    container.innerHTML = '<p class="muted">Cart is empty.</p>';
    return;
  }
  let html = '';
  for (const id in cart) {
    const qty = cart[id];
    const food = allFoods.find(x => x.id == id);
    if (!food) continue;
    html += `
      <div class="card" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>${escapeHtml(food.name)}</strong>
          <div class="muted">₹${food.price} × ${qty}</div>
        </div>
        <div>
          <button class="btn-secondary" onclick="reduceFromCart(${food.id})">−</button>
          <button class="btn-secondary" onclick="addToCart(${food.id})">+</button>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

/* ---------- Add/reduce/remove for cart panel ---------- */
function addToCart(id) {
  const cart = loadCart();
  id = String(id);
  cart[id] = (cart[id] || 0) + 1;
  saveCart(cart);
  renderCartPanel();
  renderCartDisplay();
  renderItems();
}

function reduceFromCart(id) {
  const cart = loadCart();
  id = String(id);
  if (!cart[id]) return;
  cart[id]--;
  if (cart[id] <= 0) delete cart[id];
  saveCart(cart);
  renderCartPanel();
  renderCartDisplay();
  renderItems();
}

function removeFromCart(id) {
  const cart = loadCart();
  id = String(id);
  delete cart[id];
  saveCart(cart);
  renderCartPanel();
  renderCartDisplay();
  renderItems();
}

function clearCart() {
  localStorage.removeItem("cart");
  updateCartCount();
  renderCartPanel();
  renderCartDisplay();
  renderItems();
}

function checkout() {
  const cartItems = document.getElementById('cart-items').innerHTML;
  if (!cartItems || cartItems.trim() === '') {
    alert('Your cart is empty!');
    return;
  }

  // Redirect to enter address page
  window.location.href = '/enter_address';
}



/* ---------- Fuzzy search helper ---------- */
function fuzzyScore(str, query) {
  str = str.toLowerCase();
  query = query.toLowerCase();

  if (str === query) return 1; // exact match
  if (str.includes(query)) return 0.8; // substring match

  let score = 0, i = 0, j = 0;
  while (i < str.length && j < query.length) {
    if (str[i] === query[j]) {
      score++;
      j++;
    }
    i++;
  }
  return score / query.length;
}

/* ---------- Top search input ---------- */
function doSearchTop() {
  const input = document.getElementById("search-top");
  const query = input.value.trim().toLowerCase();
  const suggestionsEl = document.getElementById("top-suggestions");

  if (!query) {
    suggestionsEl.style.display = "none";
    renderItems(); // show all items if search empty
    return;
  }

  const matches = allFoods
    .map(f => ({ food: f, score: fuzzyScore(f.name, query) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.food);

  if (matches.length === 0) {
    suggestionsEl.innerHTML = "<p class='muted'>No matches found</p>";
  } else {
    suggestionsEl.innerHTML = matches
      .map(f => `<p onclick="selectSearch('${f.name}')">${f.name}</p>`)
      .join('');
  }
  suggestionsEl.style.display = "block";

  renderItems(matches);
}

/* ---------- Select suggestion ---------- */
function selectSearch(name) {
  document.getElementById("search-top").value = name;
  document.getElementById("top-suggestions").style.display = "none";

  const filtered = allFoods.filter(f => f.name.toLowerCase() === name.toLowerCase());
  renderItems(filtered);
}

/* ---------- Update renderItems to accept optional list ---------- */
const originalRenderItems = renderItems;
renderItems = function(list = null) {
  originalRenderItems(list || allFoods.filter(f => currentFilter === 'All' || f.category === currentFilter));
};


/* ---------- Utilities ---------- */
function escapeHtml(s) { return String(s || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function escapeJs(s) { return String(s || '').replaceAll("'", "\\'").replaceAll('"', '\\"'); }

async function submitReview(event) {
    event.preventDefault();

    const name = document.getElementById("rev-name").value.trim();
    const rating = parseInt(document.querySelector('input[name="rating"]:checked')?.value || 0);
    const comment = document.getElementById("rev-comment").value.trim();
    const food_id = document.getElementById("rev-food")?.value || null;

    if (!comment || rating < 1 || rating > 5) {
        alert("Please provide a rating and feedback.");
        return;
    }

    try {
        const res = await fetch("/api/submit_review", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, rating, comment, food_id })
        });

        const data = await res.json();
        if (data.ok) {
            document.getElementById("review-status").textContent = "Feedback submitted!";
            document.getElementById("rev-name").value = "";
            document.getElementById("rev-comment").value = "";
            document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false);
        } else {
            document.getElementById("review-status").textContent = "Error: " + data.error;
        }
    } catch (err) {
        console.error(err);
        document.getElementById("review-status").textContent = "Error sending feedback.";
    }
}


function populateReviewFoodSelect() {
  const select = document.getElementById('rev-food');
  if (!select) return;
  allFoods.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.name;
    select.appendChild(opt);
  });
}

/* ---------- Init ---------- */
window.addEventListener('load', () => {
  loadFoods().catch(e=>console.error(e));
  updateCartCount();
  document.addEventListener('click', (ev) => {
    const s = document.getElementById('suggestions');
    if (s && !s.contains(ev.target) && ev.target.id !== 'search') s.style.display='none';
    const ts = document.getElementById('top-suggestions');
    if (ts && !ts.contains(ev.target) && ev.target.id !== 'search-top') ts.style.display='none';
  });
});
