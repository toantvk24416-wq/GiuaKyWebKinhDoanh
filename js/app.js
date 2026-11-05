var API_URL = "https://fakestoreapi.com/products";
var colorList = ["Đen", "Trắng", "Xám", "Đỏ", "Xanh dương", "Xanh lá", "Vàng", "Hồng", "Nâu", "Bạc"];
var categoryNames = {
    "men's clothing": "Thời trang nam",
    "women's clothing": "Thời trang nữ",
    "jewelery": "Trang sức",
    "electronics": "Điện tử"
};
var statusList = ["Chờ xác nhận", "Đang giao", "Đã thanh toán", "Đã hủy"];

var currentPage = "home";
var products = [];
var employees = [];
var customers = [];
var xmlOrders = [];
var reviewStats = {};
var cart = {
    items: {},
    totalQuantity: 0,
    totalPrice: 0
};

function loadFile(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            if (xhr.status == 200) {
                callback(xhr.responseText);
            } else {
                callback(null);
            }
        }
    };
    xhr.open("GET", url, true);
    xhr.send();
}

function getText(node, tag) {
    var list = node.getElementsByTagName(tag);
    if (list.length == 0 || list[0].childNodes.length == 0) {
        return "";
    }
    return list[0].childNodes[0].nodeValue;
}

function money(value) {
    return "$" + Number(value).toFixed(2);
}

function today() {
    var d = new Date();
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
}

function showMessage(id, text, isError) {
    var p = document.getElementById(id);
    p.innerHTML = text;
    p.className = isError ? "msg error" : "msg";
}

function showToast(text, isError) {
    var toast = document.getElementById("toast");
    toast.innerHTML = text;
    toast.className = isError ? "toast error" : "toast";
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
        toast.className = "toast hidden";
    }, 2000);
}

function openModal(html) {
    document.getElementById("modalBody").innerHTML = html;
    document.getElementById("modal").className = "modal";
}

function closeModal() {
    document.getElementById("modal").className = "modal hidden";
}

function showPage(name) {
    var pages = document.getElementsByClassName("page");
    for (var i = 0; i < pages.length; i++) {
        pages[i].className = "page";
    }
    document.getElementById(name).className = "page show";
    document.getElementById("miniCart").className = "mini-cart hidden";
    currentPage = name;
    updateCartVisibility();

    var links = document.querySelectorAll("#menu a");
    for (var j = 0; j < links.length; j++) {
        links[j].className = links[j].getAttribute("data-page") == name ? "active" : "";
    }

    if (name == "shop") openShop();
    if (name == "checkout") openCheckout();
    if (name == "admin") openAdmin();
}

function randomColors() {
    var copy = colorList.slice();
    var count = 2 + Math.floor(Math.random() * 2);
    var result = [];
    for (var i = 0; i < count; i++) {
        var index = Math.floor(Math.random() * copy.length);
        result.push(copy[index]);
        copy.splice(index, 1);
    }
    return result;
}

function addNode(xmlDoc, parent, tag, value) {
    var element = xmlDoc.createElement(tag);
    element.appendChild(xmlDoc.createTextNode(value));
    parent.appendChild(element);
    return element;
}

function findProductNode(xmlDoc, id) {
    if (xmlDoc == null) return null;
    var list = xmlDoc.getElementsByTagName("product");
    for (var i = 0; i < list.length; i++) {
        if (list[i].getAttribute("id") == id) {
            return list[i];
        }
    }
    return null;
}

function createProductsXml(data, oldDoc) {
    var xmlDoc = document.implementation.createDocument("", "products", null);
    var root = xmlDoc.documentElement;

    for (var i = 0; i < data.length; i++) {
        var p = data[i];
        var oldProduct = findProductNode(oldDoc, p.id);
        var product = xmlDoc.createElement("product");
        product.setAttribute("id", p.id);

        addNode(xmlDoc, product, "title", p.title);
        addNode(xmlDoc, product, "price", p.price);
        addNode(xmlDoc, product, "description", p.description);
        addNode(xmlDoc, product, "category", p.category);
        addNode(xmlDoc, product, "image", p.image);

        var rating = xmlDoc.createElement("rating");
        rating.setAttribute("rate", p.rating.rate);
        rating.setAttribute("count", p.rating.count);
        product.appendChild(rating);

        var list = [];
        var stock = 0;
        if (oldProduct != null) {
            var oldColors = oldProduct.getElementsByTagName("color");
            for (var k = 0; k < oldColors.length; k++) {
                list.push(oldColors[k].childNodes[0].nodeValue);
            }
            stock = getText(oldProduct, "stock");
        } else {
            list = randomColors();
            stock = 5 + Math.floor(Math.random() * 96);
        }

        var colors = xmlDoc.createElement("colors");
        for (var j = 0; j < list.length; j++) {
            addNode(xmlDoc, colors, "color", list[j]);
        }
        product.appendChild(colors);
        addNode(xmlDoc, product, "stock", stock);

        root.appendChild(product);
    }
    return xmlDoc;
}

function formatXml(xml) {
    var lines = xml.replace(/>\s*</g, ">\n<").split("\n");
    var level = 0;
    var result = "";
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf("</") == 0) {
            level--;
        }
        result += "  ".repeat(level) + line + "\n";
        var isOpenTag = line.indexOf("<") == 0 && line.indexOf("<?") != 0
            && line.indexOf("</") == -1 && line.indexOf("/>") == -1;
        if (isOpenTag) {
            level++;
        }
    }
    return result;
}

function xmlToString(xmlDoc) {
    var text = new XMLSerializer().serializeToString(xmlDoc);
    text = text.replace(/<\?xml[^>]*\?>/, "");
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + formatXml(text.trim());
}

function getOldProducts(callback) {
    var saved = localStorage.getItem("productsXML");
    if (saved != null) {
        callback(new DOMParser().parseFromString(saved, "text/xml"));
        return;
    }
    loadFile("data/products.xml", function (text) {
        if (text == null) {
            callback(null);
        } else {
            callback(new DOMParser().parseFromString(text, "text/xml"));
        }
    });
}

function xmlToProducts(xmlDoc) {
    var result = [];
    var list = xmlDoc.getElementsByTagName("product");
    for (var i = 0; i < list.length; i++) {
        var node = list[i];
        var colors = [];
        var colorNodes = node.getElementsByTagName("color");
        for (var j = 0; j < colorNodes.length; j++) {
            colors.push(colorNodes[j].childNodes[0].nodeValue);
        }
        var rating = node.getElementsByTagName("rating")[0];
        result.push({
            id: node.getAttribute("id"),
            title: getText(node, "title"),
            price: Number(getText(node, "price")),
            description: getText(node, "description"),
            category: getText(node, "category"),
            image: getText(node, "image"),
            rate: Number(rating.getAttribute("rate")),
            count: Number(rating.getAttribute("count")),
            colors: colors,
            stock: Number(getText(node, "stock"))
        });
    }
    return result;
}

function loadProducts(callback) {
    getOldProducts(function (oldDoc) {
        loadFile(API_URL, function (text) {
            if (text == null) {
                if (oldDoc != null) {
                    products = xmlToProducts(oldDoc);
                }
                callback();
                return;
            }
            var xmlDoc = createProductsXml(JSON.parse(text), oldDoc);
            localStorage.setItem("productsXML", xmlToString(xmlDoc));
            products = xmlToProducts(xmlDoc);
            callback();
        });
    });
}

function ensureProducts(callback) {
    if (products.length > 0) {
        callback();
    } else {
        getOldProducts(function (xmlDoc) {
            if (xmlDoc != null) {
                products = xmlToProducts(xmlDoc);
            }
            callback();
        });
    }
}

function findProduct(id) {
    for (var i = 0; i < products.length; i++) {
        if (products[i].id == id) {
            return products[i];
        }
    }
    return null;
}

function findById(list, id) {
    for (var i = 0; i < list.length; i++) {
        if (list[i].id == id) {
            return list[i];
        }
    }
    return null;
}

function showSkeleton() {
    var html = "";
    for (var i = 0; i < 8; i++) {
        html += '<article class="skeleton-card">'
            + '<div class="sk-img"></div>'
            + '<div class="sk-line"></div>'
            + '<div class="sk-line short"></div>'
            + '<div class="sk-line short"></div>'
            + '<div class="sk-line btn"></div>'
            + "</article>";
    }
    document.getElementById("productList").innerHTML = html;
    document.getElementById("resultInfo").innerHTML = "";
}

function openShop() {
    showSkeleton();
    var start = Date.now();
    loadProducts(function () {
        var wait = Math.max(0, 800 - (Date.now() - start));
        setTimeout(function () {
            if (products.length == 0) {
                document.getElementById("productList").innerHTML = "";
                document.getElementById("resultInfo").innerHTML = "Không tải được sản phẩm, vui lòng thử lại sau.";
                return;
            }
            loadReviews(filterProducts);
        }, wait);
    });
}

function renderColorFilter() {
    var box = document.getElementById("colorFilter");
    if (box.innerHTML != "") return;
    var html = "";
    for (var i = 0; i < colorList.length; i++) {
        html += '<label><input type="checkbox" name="color" value="' + colorList[i] + '"> ' + colorList[i] + "</label>";
    }
    box.innerHTML = html;
}

function filterProducts() {
    var keyword = document.getElementById("keyword").value.trim().toLowerCase();
    var category = document.getElementById("category").value;
    var priceMin = Number(document.getElementById("priceMin").value);
    var priceMax = Number(document.getElementById("priceMax").value);
    var ratingMin = Number(document.getElementById("ratingMin").value);
    var checked = document.querySelectorAll("#colorFilter input:checked");
    var colors = [];
    for (var i = 0; i < checked.length; i++) {
        colors.push(checked[i].value);
    }

    var result = [];
    for (var j = 0; j < products.length; j++) {
        var p = products[j];
        if (keyword != "" && p.title.toLowerCase().indexOf(keyword) == -1) continue;
        if (category != "all" && p.category != category) continue;
        if (p.price < priceMin || p.price > priceMax) continue;
        if (ratingMin > 0 && getAverage(p.id) < ratingMin) continue;
        if (colors.length > 0) {
            var hasColor = false;
            for (var k = 0; k < p.colors.length; k++) {
                if (colors.indexOf(p.colors[k]) != -1) hasColor = true;
            }
            if (!hasColor) continue;
        }
        result.push(p);
    }
    renderProducts(result);
}

function renderProducts(list) {
    document.getElementById("resultInfo").innerHTML = "Tìm thấy " + list.length + " sản phẩm";
    var html = "";
    for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var variant = p.colors[0];
        var chips = "";
        for (var j = 0; j < p.colors.length; j++) {
            chips += '<span class="chip' + (j == 0 ? " selected" : "") + '" data-color="' + p.colors[j] + '">' + p.colors[j] + "</span>";
        }
        var stockText = p.stock > 0 ? "Còn " + p.stock + " sản phẩm" : "Hết hàng";
        var disabled = p.stock > 0 ? "" : " disabled";

        html += '<article class="product-card" id="card-' + p.id + '">'
            + '<div class="thumb" id="thumb-' + p.id + '"><img src="' + p.image + '" alt="' + p.title + '"></div>'
            + "<h3>" + p.title + "</h3>"
            + '<p class="price">' + money(p.price) + "</p>"
            + '<p class="category">' + categoryNames[p.category] + "</p>"
            + '<div class="chips">' + chips + "</div>"
            + '<p class="stock' + (p.stock > 0 ? "" : " out") + '">' + stockText + "</p>"
            + '<div class="actions">'
            + '<button class="btn-add" data-id="' + p.id + '" data-variant="' + variant + '"' + disabled + ">Thêm vào giỏ hàng</button>"
            + '<button class="btn-quick" data-id="' + p.id + '" data-variant="' + variant + '">Xem nhanh</button>'
            + "</div>"
            + '<button class="btn-review" data-id="' + p.id + '">Chi tiết đánh giá</button>'
            + "</article>";
    }
    if (list.length == 0) {
        html = "<p>Không có sản phẩm phù hợp.</p>";
    }
    document.getElementById("productList").innerHTML = html;
    showStars();
}

function getAverage(id) {
    var stat = reviewStats[id];
    if (stat == null) return 0;
    return stat.total / stat.list.length;
}

function loadReviews(callback) {
    loadFile("data/reviews.xml", function (text) {
        reviewStats = {};
        if (text == null) {
            callback();
            return;
        }
        var parser = new DOMParser();
        var xmlDoc = parser.parseFromString(text, "text/xml");
        var reviews = xmlDoc.getElementsByTagName("review");
        for (var i = 0; i < reviews.length; i++) {
            var productId = getText(reviews[i], "product_id");
            var rating = Number(getText(reviews[i], "rating"));
            if (reviewStats[productId] == null) {
                reviewStats[productId] = { total: 0, list: [] };
            }
            reviewStats[productId].total += rating;
            reviewStats[productId].list.push({
                customerId: getText(reviews[i], "customer_id"),
                rating: rating,
                comment: getText(reviews[i], "comment"),
                date: getText(reviews[i], "date")
            });
        }
        callback();
    });
}

function showStars() {
    for (var i = 0; i < products.length; i++) {
        var thumb = document.getElementById("thumb-" + products[i].id);
        if (thumb == null) continue;
        var span = document.createElement("span");
        var stat = reviewStats[products[i].id];
        if (stat == null) {
            span.className = "star-badge none";
            span.textContent = "Chưa có đánh giá";
        } else {
            span.className = "star-badge";
            span.textContent = "★ " + getAverage(products[i].id).toFixed(1) + " (" + stat.list.length + ")";
        }
        thumb.appendChild(span);
    }
}

function starText(rating) {
    var full = Math.round(rating);
    return "★".repeat(full) + "☆".repeat(5 - full);
}

function showReviewDetail(id) {
    var p = findProduct(id);
    var stat = reviewStats[id];
    var html = "<h3>Đánh giá: " + p.title + "</h3>";
    if (stat == null) {
        html += "<p>Sản phẩm chưa có đánh giá nào.</p>";
        openModal(html);
        return;
    }
    html += '<p>Điểm trung bình: <span class="stars">' + starText(getAverage(id)) + "</span> <b>"
        + getAverage(id).toFixed(1) + "/5</b> từ " + stat.list.length + " khách hàng</p>"
        + "<table><tr><th>Khách hàng</th><th>Số sao</th><th>Nhận xét</th><th>Ngày</th></tr>";
    for (var i = 0; i < stat.list.length; i++) {
        var r = stat.list[i];
        var c = findById(customers, r.customerId);
        html += "<tr><td>" + (c ? c.fullName : r.customerId) + "</td>"
            + '<td class="stars">' + starText(r.rating) + "</td>"
            + "<td>" + r.comment + "</td><td>" + r.date + "</td></tr>";
    }
    html += "</table>";
    openModal(html);
}

function showQuickView(id, variant) {
    var p = findProduct(id);
    var html = '<div class="quick-view">'
        + '<img src="' + p.image + '" alt="">'
        + "<div>"
        + "<h3>" + p.title + "</h3>"
        + '<p class="price">' + money(p.price) + "</p>"
        + "<p>Mã sản phẩm: " + p.id + "</p>"
        + "<p>Danh mục: " + categoryNames[p.category] + "</p>"
        + "<p>Màu đang chọn: <b>" + variant + "</b> (có " + p.colors.join(", ") + ")</p>"
        + "<p>Tồn kho: " + p.stock + "</p>"
        + "<p>Đánh giá: " + (reviewStats[id] ? "★ " + getAverage(id).toFixed(1) + "/5 (" + reviewStats[id].list.length + " đánh giá)" : "Chưa có đánh giá") + "</p>"
        + "<p>" + p.description + "</p>"
        + '<button class="btn-add" data-id="' + p.id + '" data-variant="' + variant + '"' + (p.stock > 0 ? "" : " disabled") + ">Thêm vào giỏ hàng</button>"
        + "</div></div>";
    openModal(html);
}

function addToCart(id, variant) {
    var p = findProduct(id);
    var key = id + "-" + variant;
    var item = cart.items[key];
    var inCart = 0;
    for (var k in cart.items) {
        if (cart.items[k].id == id) inCart += cart.items[k].quantity;
    }
    if (inCart + 1 > p.stock) {
        showToast("Sản phẩm này chỉ còn " + p.stock + " cái", true);
        return;
    }
    if (item) {
        item.quantity++;
    } else {
        cart.items[key] = {
            id: p.id,
            title: p.title,
            image: p.image,
            price: p.price,
            color: variant,
            quantity: 1
        };
    }
    updateCart();
    showToast("Đã thêm " + p.title.substring(0, 30) + "... (" + variant + ") vào giỏ");
    document.getElementById("miniCart").className = "mini-cart";
}

function calculateCart() {
    var quantity = 0;
    var total = 0;
    for (var key in cart.items) {
        quantity += cart.items[key].quantity;
        total += cart.items[key].quantity * cart.items[key].price;
    }
    cart.totalQuantity = quantity;
    cart.totalPrice = total;
}

function updateCart() {
    calculateCart();
    localStorage.setItem("cart", JSON.stringify(cart.items));
    document.getElementById("cartCount").innerHTML = cart.totalQuantity;
    renderMiniCart();
}

function renderMiniCart() {
    var html = "<h4>Giỏ hàng của bạn</h4>";
    if (cart.totalQuantity == 0) {
        html += "<p>Giỏ hàng đang trống.</p>";
        html += '<div class="mini-buttons"><span></span><button class="gray mini-close">Đóng</button></div>';
        document.getElementById("miniCart").innerHTML = html;
        return;
    }
    for (var key in cart.items) {
        var item = cart.items[key];
        html += '<div class="mini-item">'
            + '<img src="' + item.image + '" alt="">'
            + '<div class="mini-info">'
            + "<p><b>" + item.title.substring(0, 40) + "</b></p>"
            + "<p>Màu: " + item.color + " | " + money(item.price) + "</p>"
            + '<p class="qty"><button class="qty-minus" data-key="' + key + '">-</button> '
            + item.quantity
            + ' <button class="qty-plus" data-key="' + key + '">+</button></p>'
            + "</div>"
            + "<div><p>" + money(item.price * item.quantity) + "</p>"
            + '<button class="red remove" data-key="' + key + '">Xóa</button></div>'
            + "</div>";
    }
    html += '<p class="mini-total">Tổng tiền: ' + money(cart.totalPrice) + "</p>"
        + '<div class="mini-buttons"><button class="gray mini-close">Đóng</button>'
        + '<button class="mini-checkout">Thanh toán</button></div>';
    document.getElementById("miniCart").innerHTML = html;
}

function handleMiniCartClick(event) {
    var target = event.target;
    var key = target.getAttribute("data-key");

    if (target.classList.contains("qty-plus")) {
        var p = findProduct(cart.items[key].id);
        var inCart = 0;
        for (var k in cart.items) {
            if (cart.items[k].id == p.id) inCart += cart.items[k].quantity;
        }
        if (inCart + 1 > p.stock) {
            showToast("Sản phẩm này chỉ còn " + p.stock + " cái", true);
            return;
        }
        cart.items[key].quantity++;
    } else if (target.classList.contains("qty-minus")) {
        cart.items[key].quantity--;
        if (cart.items[key].quantity == 0) {
            delete cart.items[key];
        }
    } else if (target.classList.contains("remove")) {
        delete cart.items[key];
    } else if (target.classList.contains("mini-close")) {
        document.getElementById("miniCart").className = "mini-cart hidden";
        return;
    } else if (target.classList.contains("mini-checkout")) {
        showPage("checkout");
        return;
    } else {
        return;
    }
    updateCart();
    if (document.getElementById("checkout").className == "page show") {
        renderCheckoutSummary();
    }
}

function toggleMiniCart() {
    var box = document.getElementById("miniCart");
    if (box.className == "mini-cart hidden") {
        renderMiniCart();
        box.className = "mini-cart";
    } else {
        box.className = "mini-cart hidden";
    }
}

function loadCart() {
    var saved = localStorage.getItem("cart");
    if (saved != null) {
        cart.items = JSON.parse(saved);
    }
    calculateCart();
    document.getElementById("cartCount").innerHTML = cart.totalQuantity;
}

function handleProductClick(event) {
    var target = event.target;

    if (target.classList.contains("chip")) {
        var card = target.parentNode.parentNode;
        var chips = card.getElementsByClassName("chip");
        for (var i = 0; i < chips.length; i++) {
            chips[i].classList.remove("selected");
        }
        target.classList.add("selected");
        var buttons = card.querySelectorAll("[data-variant]");
        for (var j = 0; j < buttons.length; j++) {
            buttons[j].setAttribute("data-variant", target.getAttribute("data-color"));
        }
        return;
    }

    var id = target.getAttribute("data-id");
    var variant = target.getAttribute("data-variant");

    if (target.classList.contains("btn-add")) {
        addToCart(id, variant);
    } else if (target.classList.contains("btn-quick")) {
        showQuickView(id, variant);
    } else if (target.classList.contains("btn-review")) {
        showReviewDetail(id);
    }
}

var rules = {
    shipName: {
        error: "errName",
        regex: /^[A-Za-zÀ-ỹ\s]{2,50}$/,
        message: "Họ tên chỉ gồm chữ cái, từ 2 đến 50 ký tự"
    },
    shipPhone: {
        error: "errPhone",
        regex: /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/,
        message: "Số điện thoại Việt Nam gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84"
    },
    shipEmail: {
        error: "errEmail",
        regex: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9-]+(\.[a-zA-Z]{2,})+$/,
        message: "Email không đúng định dạng, ví dụ: ten@gmail.com"
    },
    shipAddress: {
        error: "errAddress",
        regex: /^.{5,200}$/,
        message: "Địa chỉ phải có ít nhất 5 ký tự"
    }
};

function validateField(id) {
    var input = document.getElementById(id);
    var rule = rules[id];
    var value = input.value.trim();
    var error = document.getElementById(rule.error);

    if (value == "") {
        error.innerHTML = "Vui lòng nhập thông tin này";
        input.className = "invalid";
        return false;
    }
    if (!rule.regex.test(value)) {
        error.innerHTML = rule.message;
        input.className = "invalid";
        return false;
    }
    error.innerHTML = "";
    input.className = "valid";
    return true;
}

function openCheckout() {
    document.getElementById("checkoutSuccess").className = "success-box hidden";
    document.getElementById("checkoutLayout").className = "checkout-layout";
    showMessage("checkoutMsg", "", false);
    var user = getCurrentUser();
    if (user != null && user.type == "customer") {
        var c = findById(customers, user.id);
        if (c != null) {
            if (document.getElementById("shipName").value == "") document.getElementById("shipName").value = c.fullName;
            if (document.getElementById("shipPhone").value == "") document.getElementById("shipPhone").value = c.phone;
            if (document.getElementById("shipEmail").value == "") document.getElementById("shipEmail").value = c.email;
            if (document.getElementById("shipAddress").value == "") document.getElementById("shipAddress").value = c.address;
        }
    }
    ensureProducts(renderCheckoutSummary);
}

function renderCheckoutSummary() {
    var box = document.getElementById("checkoutSummary");
    if (cart.totalQuantity == 0) {
        box.innerHTML = '<p>Giỏ hàng đang trống.</p><button class="go-shop" data-page="shop">Tiếp tục mua sắm</button>';
        return;
    }
    var html = "<table><tr><th>Sản phẩm</th><th>Màu</th><th>SL</th><th>Thành tiền</th></tr>";
    for (var key in cart.items) {
        var item = cart.items[key];
        html += "<tr><td>" + item.title.substring(0, 35) + "</td><td>" + item.color + "</td><td>"
            + item.quantity + "</td><td>" + money(item.price * item.quantity) + "</td></tr>";
    }
    html += "</table><p class=\"total\">Tổng tiền: " + money(cart.totalPrice) + "</p>";
    box.innerHTML = html;
}

function getLocalOrders() {
    var saved = localStorage.getItem("orders");
    return saved == null ? [] : JSON.parse(saved);
}

function decreaseStock(items) {
    var saved = localStorage.getItem("productsXML");
    if (saved == null) return;
    var xmlDoc = new DOMParser().parseFromString(saved, "text/xml");
    for (var i = 0; i < items.length; i++) {
        var node = findProductNode(xmlDoc, items[i].productId);
        if (node == null) continue;
        var stockNode = node.getElementsByTagName("stock")[0];
        var newStock = Number(stockNode.childNodes[0].nodeValue) - items[i].quantity;
        stockNode.childNodes[0].nodeValue = Math.max(0, newStock);
    }
    localStorage.setItem("productsXML", xmlToString(xmlDoc));
    products = xmlToProducts(xmlDoc);
}

function submitCheckout(event) {
    event.preventDefault();
    var ok = true;
    for (var id in rules) {
        if (!validateField(id)) ok = false;
    }
    if (cart.totalQuantity == 0) {
        showMessage("checkoutMsg", "Giỏ hàng đang trống, hãy chọn sản phẩm trước.", true);
        return;
    }
    if (!ok) {
        showMessage("checkoutMsg", "Vui lòng kiểm tra lại các thông tin bị đánh dấu đỏ.", true);
        return;
    }

    var orders = getLocalOrders();
    var user = getCurrentUser();
    var items = [];
    for (var key in cart.items) {
        var item = cart.items[key];
        items.push({
            productId: item.id,
            color: item.color,
            quantity: item.quantity,
            unitPrice: item.price
        });
    }
    var order = {
        id: "DH" + String(orders.length + 1).padStart(3, "0"),
        createdDate: today(),
        employeeId: "",
        customerId: user != null && user.type == "customer" ? user.id : "",
        customerName: document.getElementById("shipName").value.trim(),
        phone: document.getElementById("shipPhone").value.trim(),
        email: document.getElementById("shipEmail").value.trim(),
        shippingAddress: document.getElementById("shipAddress").value.trim(),
        paymentMethod: document.getElementById("shipPayment").value,
        note: document.getElementById("shipNote").value.trim(),
        status: "Chờ xác nhận",
        items: items,
        total: Number(cart.totalPrice.toFixed(2))
    };
    orders.push(order);
    localStorage.setItem("orders", JSON.stringify(orders));
    decreaseStock(items);

    cart.items = {};
    updateCart();
    document.getElementById("checkoutForm").reset();
    var inputs = document.querySelectorAll("#checkoutForm input");
    for (var i = 0; i < inputs.length; i++) {
        inputs[i].className = "";
    }

    document.getElementById("checkoutLayout").className = "checkout-layout hidden";
    var box = document.getElementById("checkoutSuccess");
    box.className = "success-box";
    box.innerHTML = "<h3>Thanh toán thành công!</h3>"
        + "<p>Mã đơn hàng: <b>" + order.id + "</b></p>"
        + "<p>Tổng tiền: <b>" + money(order.total) + "</b> - " + order.paymentMethod + "</p>"
        + "<p>Đơn hàng sẽ được giao đến: " + order.shippingAddress + "</p>"
        + '<button class="go-shop" data-page="shop">Tiếp tục mua sắm</button>';
}

function updateCartVisibility() {
    var user = getCurrentUser();
    var isEmployee = user != null && user.type == "employee";
    var hide = currentPage == "login" || currentPage == "admin" || isEmployee;
    document.querySelector(".cart-wrap").className = hide ? "cart-wrap hidden" : "cart-wrap";
    if (hide) {
        document.getElementById("miniCart").className = "mini-cart hidden";
    }
}

function getCurrentUser() {
    var text = localStorage.getItem("currentUser");
    if (text == null) return null;
    return JSON.parse(text);
}

function findAccount(list, username, password) {
    for (var i = 0; i < list.length; i++) {
        if (list[i].username == username && list[i].password == password) {
            return list[i];
        }
    }
    return null;
}

function saveUser(user, type) {
    var currentUser = {
        id: user.id,
        fullName: user.fullName,
        type: type,
        role: type == "employee" ? user.role : "customer"
    };
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    updateUserBox();
}

function customerLogin(event) {
    event.preventDefault();
    var username = document.getElementById("username").value.trim();
    var password = document.getElementById("password").value;
    var user = findAccount(customers, username, password);
    if (user == null) {
        showMessage("loginMsg", "Sai tên đăng nhập hoặc mật khẩu.", true);
        return;
    }
    if (user.status != "active") {
        showMessage("loginMsg", "Tài khoản đã bị khóa, không thể đăng nhập.", true);
        return;
    }
    saveUser(user, "customer");
    document.getElementById("loginForm").reset();
    showMessage("loginMsg", "", false);
    showToast("Xin chào " + user.fullName);
    showPage("shop");
}

function adminLogin(event) {
    event.preventDefault();
    var username = document.getElementById("adminUser").value.trim();
    var password = document.getElementById("adminPass").value;
    var user = findAccount(employees, username, password);
    if (user == null) {
        showMessage("adminLoginMsg", "Sai tên đăng nhập hoặc mật khẩu.", true);
        return;
    }
    if (user.status != "active") {
        showMessage("adminLoginMsg", "Tài khoản đã bị khóa, không thể đăng nhập.", true);
        return;
    }
    saveUser(user, "employee");
    document.getElementById("adminLoginForm").reset();
    showMessage("adminLoginMsg", "", false);
    openAdmin();
}

function logout() {
    localStorage.removeItem("currentUser");
    updateUserBox();
    showPage("home");
}

function updateUserBox() {
    updateCartVisibility();
    var user = getCurrentUser();
    var box = document.getElementById("userBox");
    if (user == null) {
        box.innerHTML = "";
        document.getElementById("menuLogin").className = "";
        return;
    }
    var roleName = "Khách hàng";
    if (user.role == "admin") roleName = "Quản trị viên";
    if (user.role == "staff") roleName = "Nhân viên";
    box.innerHTML = "Xin chào " + user.fullName + " (" + roleName + ")"
        + '<a href="#" id="btnLogout">Đăng xuất</a>';
    document.getElementById("btnLogout").onclick = function (e) {
        e.preventDefault();
        logout();
    };
    document.getElementById("menuLogin").className = "hidden";
}

function parseXmlOrders(text) {
    var result = [];
    var xmlDoc = new DOMParser().parseFromString(text, "text/xml");
    var carts = xmlDoc.getElementsByTagName("cart");
    for (var i = 0; i < carts.length; i++) {
        var items = [];
        var itemNodes = carts[i].getElementsByTagName("item");
        for (var j = 0; j < itemNodes.length; j++) {
            items.push({
                productId: itemNodes[j].getAttribute("productId"),
                color: getText(itemNodes[j], "color"),
                quantity: Number(getText(itemNodes[j], "quantity")),
                unitPrice: Number(getText(itemNodes[j], "unitPrice"))
            });
        }
        var customer = findById(customers, getText(carts[i], "customerId"));
        result.push({
            id: carts[i].getAttribute("id"),
            createdDate: getText(carts[i], "createdDate"),
            employeeId: getText(carts[i], "employeeId"),
            customerId: getText(carts[i], "customerId"),
            customerName: customer ? customer.fullName : "",
            phone: customer ? customer.phone : "",
            email: customer ? customer.email : "",
            shippingAddress: getText(carts[i], "shippingAddress"),
            paymentMethod: getText(carts[i], "paymentMethod"),
            note: "",
            status: getText(carts[i], "status"),
            items: items,
            total: Number(getText(carts[i], "total"))
        });
    }
    return result;
}

function getAllOrders() {
    var changes = JSON.parse(localStorage.getItem("orderChanges") || "{}");
    var list = xmlOrders.concat(getLocalOrders());
    for (var i = 0; i < list.length; i++) {
        var change = changes[list[i].id];
        if (change) {
            list[i].status = change.status;
            if (change.employeeId) list[i].employeeId = change.employeeId;
        }
    }
    return list;
}

function changeOrderStatus(id, status) {
    var changes = JSON.parse(localStorage.getItem("orderChanges") || "{}");
    var user = getCurrentUser();
    var order = findById(getAllOrders(), id);
    var employeeId = order.employeeId;
    if (employeeId == "") employeeId = user.id;
    changes[id] = { status: status, employeeId: employeeId };
    localStorage.setItem("orderChanges", JSON.stringify(changes));
    showToast("Đã cập nhật đơn " + id + ": " + status);
    renderOrders();
    renderStats();
    renderSold();
}

function openAdmin() {
    var user = getCurrentUser();
    if (user == null || user.type != "employee") {
        document.getElementById("adminLogin").className = "";
        document.getElementById("adminPanel").className = "hidden";
        return;
    }
    document.getElementById("adminLogin").className = "hidden";
    document.getElementById("adminPanel").className = "";
    ensureProducts(function () {
        renderStats();
        renderOrders();
        renderSold();
        renderEmployees();
        renderCustomers();
    });
}

function showTab(tabId) {
    var tabs = document.getElementsByClassName("tab");
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].className = "tab";
    }
    document.getElementById(tabId).className = "tab show";
    var buttons = document.querySelectorAll("#adminTabs button");
    for (var j = 0; j < buttons.length; j++) {
        buttons[j].className = buttons[j].getAttribute("data-tab") == tabId ? "active" : "";
    }
}

function statusColor(status) {
    if (status == "Đã thanh toán") return "#d4f5e0";
    if (status == "Đang giao") return "#dbe8ff";
    if (status == "Đã hủy") return "#fde0dc";
    return "#fff3cd";
}

function renderStats() {
    var orders = getAllOrders();
    var count = {};
    for (var s = 0; s < statusList.length; s++) {
        count[statusList[s]] = 0;
    }
    var revenue = 0;
    var sold = 0;
    for (var i = 0; i < orders.length; i++) {
        count[orders[i].status]++;
        if (orders[i].status == "Đã thanh toán") revenue += orders[i].total;
        if (orders[i].status != "Đã hủy") {
            for (var j = 0; j < orders[i].items.length; j++) {
                sold += orders[i].items[j].quantity;
            }
        }
    }
    var totalStock = 0;
    for (var k = 0; k < products.length; k++) {
        totalStock += products[k].stock;
    }

    var html = '<div class="cards">'
        + '<div class="stat">Tổng đơn hàng<b>' + orders.length + "</b></div>"
        + '<div class="stat">Doanh thu đã thanh toán<b>' + money(revenue) + "</b></div>"
        + '<div class="stat">Sản phẩm đã bán<b>' + sold + "</b></div>"
        + '<div class="stat">Tổng tồn kho<b>' + totalStock + "</b></div>"
        + '<div class="stat">Khách hàng<b>' + customers.length + "</b></div>"
        + '<div class="stat">Nhân viên<b>' + employees.length + "</b></div>"
        + "</div>"
        + '<div class="box"><h3>Đơn hàng theo trạng thái</h3>';
    for (var t = 0; t < statusList.length; t++) {
        var percent = orders.length == 0 ? 0 : count[statusList[t]] * 100 / orders.length;
        html += '<div class="bar-row"><span class="bar-label">' + statusList[t] + "</span>"
            + '<div class="bar-track"><div class="bar-fill" style="width:' + percent + '%"></div></div>'
            + "<span>" + count[statusList[t]] + "</span></div>";
    }
    html += "</div>";
    document.getElementById("tabStats").innerHTML = html;
}

function renderOrders() {
    var keyword = document.getElementById("orderSearch").value.trim().toLowerCase();
    var filter = document.getElementById("orderFilter").value;
    var orders = getAllOrders();
    var html = "<table><tr><th>Mã đơn</th><th>Ngày tạo</th><th>Khách hàng</th><th>Nhân viên</th>"
        + "<th>Thanh toán</th><th>Tổng tiền</th><th>Trạng thái</th><th></th></tr>";
    var shown = 0;
    for (var i = orders.length - 1; i >= 0; i--) {
        var o = orders[i];
        if (filter != "all" && o.status != filter) continue;
        if (keyword != "" && o.id.toLowerCase().indexOf(keyword) == -1
            && o.customerName.toLowerCase().indexOf(keyword) == -1) continue;
        shown++;
        var employee = findById(employees, o.employeeId);
        var options = "";
        for (var s = 0; s < statusList.length; s++) {
            options += "<option" + (statusList[s] == o.status ? " selected" : "") + ">" + statusList[s] + "</option>";
        }
        html += "<tr><td><b>" + o.id + "</b></td><td>" + o.createdDate + "</td><td>" + o.customerName + "</td>"
            + "<td>" + (employee ? employee.fullName : "Chưa phân công") + "</td>"
            + "<td>" + o.paymentMethod + "</td><td>" + money(o.total) + "</td>"
            + '<td><select class="order-status" data-id="' + o.id + '" style="background:' + statusColor(o.status) + '">' + options + "</select></td>"
            + '<td><button class="order-detail" data-id="' + o.id + '">Chi tiết</button></td></tr>';
    }
    html += "</table>";
    if (shown == 0) html = "<p>Không có đơn hàng phù hợp.</p>";
    document.getElementById("orderTable").innerHTML = html;
}

function showOrderDetail(id) {
    var o = findById(getAllOrders(), id);
    var employee = findById(employees, o.employeeId);
    var html = "<h3>Đơn hàng " + o.id + "</h3>"
        + "<p>Ngày tạo: " + o.createdDate + " | Trạng thái: <b>" + o.status + "</b></p>"
        + "<p>Khách hàng: " + o.customerName + " | SĐT: " + o.phone + " | Email: " + o.email + "</p>"
        + "<p>Giao đến: " + o.shippingAddress + "</p>"
        + "<p>Nhân viên: " + (employee ? employee.fullName : "Chưa phân công") + " | Thanh toán: " + o.paymentMethod + "</p>";
    if (o.note != "") html += "<p>Ghi chú: " + o.note + "</p>";
    html += "<table><tr><th>STT</th><th>Sản phẩm</th><th>Màu</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr>";
    for (var i = 0; i < o.items.length; i++) {
        var item = o.items[i];
        var p = findProduct(item.productId);
        html += "<tr><td>" + (i + 1) + "</td><td>" + (p ? p.title : item.productId) + "</td><td>" + item.color + "</td>"
            + "<td>" + item.quantity + "</td><td>" + money(item.unitPrice) + "</td>"
            + "<td>" + money(item.quantity * item.unitPrice) + "</td></tr>";
    }
    html += '</table><p class="total">Tổng tiền: ' + money(o.total) + "</p>";
    openModal(html);
}

function handleOrderTable(event) {
    var target = event.target;
    if (event.type == "click" && target.classList.contains("order-detail")) {
        showOrderDetail(target.getAttribute("data-id"));
    }
    if (event.type == "change" && target.classList.contains("order-status")) {
        changeOrderStatus(target.getAttribute("data-id"), target.value);
    }
}

function renderSold() {
    var orders = getAllOrders();
    var sold = {};
    for (var i = 0; i < orders.length; i++) {
        if (orders[i].status == "Đã hủy") continue;
        for (var j = 0; j < orders[i].items.length; j++) {
            var item = orders[i].items[j];
            if (sold[item.productId] == null) {
                sold[item.productId] = { productId: item.productId, quantity: 0, revenue: 0 };
            }
            sold[item.productId].quantity += item.quantity;
            sold[item.productId].revenue += item.quantity * item.unitPrice;
        }
    }
    var list = [];
    for (var key in sold) {
        list.push(sold[key]);
    }
    list.sort(function (a, b) {
        return b.quantity - a.quantity;
    });

    var max = list.length > 0 ? list[0].quantity : 1;
    var html = "<table><tr><th>Hạng</th><th>Ảnh</th><th>Sản phẩm</th><th>Số lượng bán</th><th>Doanh thu</th><th>Tồn kho</th><th style=\"width:25%\"></th></tr>";
    for (var k = 0; k < list.length; k++) {
        var p = findProduct(list[k].productId);
        html += "<tr><td>" + (k + 1) + "</td>"
            + '<td><img class="small-img" src="' + (p ? p.image : "") + '" alt=""></td>'
            + "<td>" + (p ? p.title : list[k].productId) + "</td>"
            + "<td>" + list[k].quantity + "</td><td>" + money(list[k].revenue) + "</td>"
            + "<td>" + (p ? p.stock : "") + "</td>"
            + '<td><div class="bar-track"><div class="bar-fill" style="width:' + (list[k].quantity * 100 / max) + '%"></div></div></td></tr>';
    }
    html += "</table>";
    if (list.length == 0) html = "<p>Chưa có sản phẩm nào được bán.</p>";
    document.getElementById("tabSold").innerHTML = "<p>Không tính các đơn đã hủy.</p>" + html;
}

function renderEmployees() {
    var html = "<table><tr><th>Mã NV</th><th>Họ tên</th><th>Tên đăng nhập</th><th>Vai trò</th>"
        + "<th>Giới tính</th><th>Email</th><th>Điện thoại</th><th>Ngày vào làm</th><th>Trạng thái</th></tr>";
    for (var i = 0; i < employees.length; i++) {
        var e = employees[i];
        html += "<tr><td>" + e.id + "</td><td>" + e.fullName + "</td><td>" + e.username + "</td>"
            + "<td>" + (e.role == "admin" ? "Quản trị viên" : "Nhân viên") + "</td><td>" + e.gender + "</td>"
            + "<td>" + e.email + "</td><td>" + e.phone + "</td><td>" + e.startDate + "</td>"
            + "<td>" + (e.status == "active" ? "Đang làm" : "Nghỉ") + "</td></tr>";
    }
    document.getElementById("tabEmployees").innerHTML = html + "</table>";
}

function renderCustomers() {
    var html = "<table><tr><th>Mã KH</th><th>Họ tên</th><th>Tên đăng nhập</th><th>Giới tính</th>"
        + "<th>Email</th><th>Điện thoại</th><th>Địa chỉ</th><th>Điểm</th><th>Trạng thái</th></tr>";
    for (var i = 0; i < customers.length; i++) {
        var c = customers[i];
        html += "<tr><td>" + c.id + "</td><td>" + c.fullName + "</td><td>" + c.username + "</td>"
            + "<td>" + c.gender + "</td><td>" + c.email + "</td><td>" + c.phone + "</td>"
            + "<td>" + c.address + "</td><td>" + c.points + "</td>"
            + "<td>" + (c.status == "active" ? "Hoạt động" : "Bị khóa") + "</td></tr>";
    }
    document.getElementById("tabCustomers").innerHTML = html + "</table>";
}

function handlePageLinks(event) {
    var target = event.target;
    var page = target.getAttribute("data-page");
    if (page != null) {
        event.preventDefault();
        showPage(page);
    }
}

function loadData(callback) {
    loadFile("data/employees.json", function (empText) {
        loadFile("data/customers.json", function (cusText) {
            loadFile("data/carts.xml", function (cartText) {
                if (empText != null) employees = JSON.parse(empText);
                if (cusText != null) customers = JSON.parse(cusText);
                if (cartText != null) xmlOrders = parseXmlOrders(cartText);
                callback();
            });
        });
    });
}

window.onload = function () {
    document.body.addEventListener("click", handlePageLinks);

    document.getElementById("modal").onclick = function (event) {
        var target = event.target;
        if (target.id == "modal" || target.classList.contains("modal-close")) {
            closeModal();
        } else if (target.classList.contains("btn-add")) {
            addToCart(target.getAttribute("data-id"), target.getAttribute("data-variant"));
            closeModal();
        }
    };
    document.getElementById("productList").addEventListener("click", handleProductClick);
    document.getElementById("miniCart").addEventListener("click", handleMiniCartClick);
    document.getElementById("cartButton").onclick = toggleMiniCart;

    var searchForm = document.getElementById("searchForm");
    searchForm.onsubmit = function (event) {
        event.preventDefault();
        var priceMax = document.getElementById("priceMax");
        var min = Number(document.getElementById("priceMin").value);
        if (Number(priceMax.value) < min) {
            priceMax.setCustomValidity("Giá đến phải lớn hơn hoặc bằng giá từ");
            priceMax.reportValidity();
            return;
        }
        filterProducts();
    };
    document.getElementById("priceMax").oninput = function () {
        this.setCustomValidity("");
    };
    document.getElementById("priceMin").oninput = function () {
        document.getElementById("priceMax").setCustomValidity("");
    };
    searchForm.onreset = function () {
        document.getElementById("ratingValue").innerHTML = "0";
        setTimeout(filterProducts, 0);
    };
    document.getElementById("ratingMin").oninput = function () {
        document.getElementById("ratingValue").innerHTML = this.value;
    };

    for (var id in rules) {
        var input = document.getElementById(id);
        input.onkeyup = function () {
            validateField(this.id);
        };
        input.onblur = function () {
            validateField(this.id);
        };
    }
    document.getElementById("checkoutForm").onsubmit = submitCheckout;

    document.getElementById("loginForm").onsubmit = customerLogin;
    document.getElementById("adminLoginForm").onsubmit = adminLogin;

    document.getElementById("adminTabs").onclick = function (event) {
        var tab = event.target.getAttribute("data-tab");
        if (tab != null) showTab(tab);
    };
    var orderTable = document.getElementById("orderTable");
    orderTable.addEventListener("click", handleOrderTable);
    orderTable.addEventListener("change", handleOrderTable);
    document.getElementById("orderSearch").onkeyup = renderOrders;
    document.getElementById("orderFilter").onchange = renderOrders;

    renderColorFilter();
    loadCart();
    updateUserBox();
    loadData(function () {});
};
