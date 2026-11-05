var API_URL = "https://fakestoreapi.com/products";
var colorList = ["Đen", "Trắng", "Xám", "Đỏ", "Xanh dương", "Xanh lá", "Vàng", "Hồng", "Nâu", "Bạc"];

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

function showMessage(id, text, isError) {
    var p = document.getElementById(id);
    p.innerHTML = text;
    if (isError) {
        p.className = "msg error";
    } else {
        p.className = "msg";
    }
}

function showPage(name) {
    var pages = document.getElementsByClassName("page");
    for (var i = 0; i < pages.length; i++) {
        pages[i].className = "page";
    }
    document.getElementById(name).className = "page show";

    var links = document.querySelectorAll("#menu a");
    for (var j = 0; j < links.length; j++) {
        if (links[j].getAttribute("data-page") == name) {
            links[j].className = "active";
        } else {
            links[j].className = "";
        }
    }

    if (name == "products") openProducts();
    if (name == "employees") showEmployees();
    if (name == "customers") showCustomers();
    if (name == "carts") showCarts();
    if (name == "dashboard") showDashboard();
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
    var products = xmlDoc.getElementsByTagName("product");
    for (var i = 0; i < products.length; i++) {
        if (products[i].getAttribute("id") == id) {
            return products[i];
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
    loadFile("../data/products.xml", function (text) {
        if (text == null) {
            callback(null);
        } else {
            callback(new DOMParser().parseFromString(text, "text/xml"));
        }
    });
}

function openProducts() {
    showMessage("productMsg", "", false);
    getOldProducts(function (oldDoc) {
        loadFile(API_URL, function (text) {
            if (text == null) {
                if (oldDoc != null) {
                    renderProducts(oldDoc);
                } else {
                    showMessage("productMsg", "Không tải được sản phẩm, vui lòng thử lại sau.", true);
                }
                return;
            }
            var data = JSON.parse(text);
            var xmlDoc = createProductsXml(data, oldDoc);
            var xmlString = xmlToString(xmlDoc);
            localStorage.setItem("productsXML", xmlString);
            renderProducts(xmlDoc);
        });
    });
}

function renderProducts(xmlDoc) {
    var products = xmlDoc.getElementsByTagName("product");
    var html = "";
    for (var i = 0; i < products.length; i++) {
        var p = products[i];
        var colors = p.getElementsByTagName("color");
        var colorHtml = "";
        for (var j = 0; j < colors.length; j++) {
            colorHtml += '<span class="color">' + colors[j].childNodes[0].nodeValue + "</span>";
        }
        var rating = p.getElementsByTagName("rating")[0];

        html += '<div class="card">'
            + '<img src="' + getText(p, "image") + '" alt="">'
            + "<h4>" + p.getAttribute("id") + ". " + getText(p, "title") + "</h4>"
            + '<p class="price">$' + getText(p, "price") + "</p>"
            + "<p>Loại: " + getText(p, "category") + "</p>"
            + "<p>Đánh giá: " + rating.getAttribute("rate") + " (" + rating.getAttribute("count") + ")</p>"
            + "<p>Màu: " + colorHtml + "</p>"
            + "<p>Tồn kho: <b>" + getText(p, "stock") + "</b></p>"
            + "</div>";
    }
    document.getElementById("productList").innerHTML = html;
}

function getProductsDoc(callback) {
    getOldProducts(callback);
}

function showEmployees() {
    loadFile("../data/employees.json", function (text) {
        var box = document.getElementById("employeeTable");
        if (text == null) {
            box.innerHTML = '<p class="msg error">Không tải được dữ liệu, vui lòng thử lại sau.</p>';
            return;
        }
        var list = JSON.parse(text);
        var html = "<table><tr><th>Mã NV</th><th>Họ tên</th><th>Tên đăng nhập</th><th>Mật khẩu</th><th>Vai trò</th>"
            + "<th>Giới tính</th><th>Ngày sinh</th><th>Email</th><th>Điện thoại</th><th>Ngày vào làm</th><th>Trạng thái</th></tr>";
        for (var i = 0; i < list.length; i++) {
            var e = list[i];
            html += "<tr><td>" + e.id + "</td><td>" + e.fullName + "</td><td>" + e.username + "</td><td>******</td>"
                + "<td>" + e.role + "</td><td>" + e.gender + "</td><td>" + e.birthDate + "</td><td>" + e.email + "</td>"
                + "<td>" + e.phone + "</td><td>" + e.startDate + "</td><td>" + e.status + "</td></tr>";
        }
        html += "</table>";
        box.innerHTML = html;
    });
}

function showCustomers() {
    loadFile("../data/customers.json", function (text) {
        var box = document.getElementById("customerTable");
        if (text == null) {
            box.innerHTML = '<p class="msg error">Không tải được dữ liệu, vui lòng thử lại sau.</p>';
            return;
        }
        var list = JSON.parse(text);
        var html = "<table><tr><th>Mã KH</th><th>Họ tên</th><th>Tên đăng nhập</th><th>Mật khẩu</th><th>Giới tính</th>"
            + "<th>Ngày sinh</th><th>Email</th><th>Điện thoại</th><th>Địa chỉ</th><th>Ngày tạo</th><th>Điểm</th><th>Trạng thái</th></tr>";
        for (var i = 0; i < list.length; i++) {
            var c = list[i];
            html += "<tr><td>" + c.id + "</td><td>" + c.fullName + "</td><td>" + c.username + "</td><td>******</td>"
                + "<td>" + c.gender + "</td><td>" + c.birthDate + "</td><td>" + c.email + "</td><td>" + c.phone + "</td>"
                + "<td>" + c.address + "</td><td>" + c.createdAt + "</td><td>" + c.points + "</td><td>" + c.status + "</td></tr>";
        }
        html += "</table>";
        box.innerHTML = html;
    });
}

function findById(list, id) {
    for (var i = 0; i < list.length; i++) {
        if (list[i].id == id) {
            return list[i];
        }
    }
    return null;
}

function findProductTitle(productDoc, id) {
    if (productDoc == null) return "";
    var products = productDoc.getElementsByTagName("product");
    for (var i = 0; i < products.length; i++) {
        if (products[i].getAttribute("id") == id) {
            return getText(products[i], "title");
        }
    }
    return "";
}

function showCarts() {
    var box = document.getElementById("cartList");
    loadFile("../data/carts.xml", function (cartText) {
        if (cartText == null) {
            box.innerHTML = '<p class="msg error">Không tải được dữ liệu, vui lòng thử lại sau.</p>';
            return;
        }
        loadFile("../data/employees.json", function (empText) {
            loadFile("../data/customers.json", function (cusText) {
                getProductsDoc(function (productDoc) {
                    var employees = JSON.parse(empText);
                    var customers = JSON.parse(cusText);
                    var cartDoc = new DOMParser().parseFromString(cartText, "text/xml");
                    renderCarts(cartDoc, employees, customers, productDoc);
                });
            });
        });
    });
}

function renderCarts(cartDoc, employees, customers, productDoc) {
    var carts = cartDoc.getElementsByTagName("cart");
    var html = "<p>Tổng số hóa đơn: <b>" + carts.length + "</b></p>";

    for (var i = 0; i < carts.length; i++) {
        var cart = carts[i];
        var employee = findById(employees, getText(cart, "employeeId"));
        var customer = findById(customers, getText(cart, "customerId"));

        html += '<div class="invoice">'
            + "<h3>Hóa đơn " + cart.getAttribute("id") + "</h3>"
            + "<p>Ngày tạo: " + getText(cart, "createdDate")
            + " | Nhân viên: " + getText(cart, "employeeId") + " - " + (employee ? employee.fullName : "")
            + " | Khách hàng: " + getText(cart, "customerId") + " - " + (customer ? customer.fullName : "") + "</p>"
            + "<p>Trạng thái: " + getText(cart, "status")
            + " | Thanh toán: " + getText(cart, "paymentMethod")
            + " | Giao đến: " + getText(cart, "shippingAddress") + "</p>"
            + "<table><tr><th>STT</th><th>Mã SP</th><th>Tên sản phẩm</th><th>Màu</th><th>Số lượng</th><th>Đơn giá</th><th>Thành tiền</th></tr>";

        var items = cart.getElementsByTagName("item");
        var sum = 0;
        for (var j = 0; j < items.length; j++) {
            var item = items[j];
            var productId = item.getAttribute("productId");
            var quantity = Number(getText(item, "quantity"));
            var unitPrice = Number(getText(item, "unitPrice"));
            var money = quantity * unitPrice;
            sum += money;
            html += "<tr><td>" + (j + 1) + "</td><td>" + productId + "</td><td>" + findProductTitle(productDoc, productId) + "</td>"
                + "<td>" + getText(item, "color") + "</td><td>" + quantity + "</td><td>$" + unitPrice.toFixed(2) + "</td>"
                + "<td>$" + money.toFixed(2) + "</td></tr>";
        }
        html += "</table>"
            + '<p class="total">Tổng tiền: $' + sum.toFixed(2) + "</p>"
            + "</div>";
    }
    document.getElementById("cartList").innerHTML = html;
}

function login(event) {
    event.preventDefault();
    var username = document.getElementById("username").value.trim();
    var password = document.getElementById("password").value;

    if (username == "" || password == "") {
        showMessage("loginMsg", "Vui lòng nhập tên đăng nhập và mật khẩu.", true);
        return;
    }

    loadFile("../data/employees.json", function (empText) {
        loadFile("../data/customers.json", function (cusText) {
            if (empText == null || cusText == null) {
                showMessage("loginMsg", "Không tải được dữ liệu, vui lòng thử lại sau.", true);
                return;
            }
            var employees = JSON.parse(empText);
            var customers = JSON.parse(cusText);
            var user = null;
            var type = "";

            for (var i = 0; i < employees.length; i++) {
                if (employees[i].username == username && employees[i].password == password) {
                    user = employees[i];
                    type = "employee";
                }
            }
            for (var j = 0; j < customers.length; j++) {
                if (customers[j].username == username && customers[j].password == password) {
                    user = customers[j];
                    type = "customer";
                }
            }

            if (user == null) {
                showMessage("loginMsg", "Sai tên đăng nhập hoặc mật khẩu.", true);
                return;
            }
            if (user.status != "active") {
                showMessage("loginMsg", "Tài khoản đã bị khóa, không thể đăng nhập.", true);
                return;
            }

            var currentUser = {
                id: user.id,
                fullName: user.fullName,
                type: type,
                role: type == "employee" ? user.role : "customer"
            };
            localStorage.setItem("currentUser", JSON.stringify(currentUser));
            document.getElementById("loginForm").reset();
            showMessage("loginMsg", "", false);
            updateUserBox();
            if (currentUser.role == "admin") {
                showPage("dashboard");
            } else {
                showPage("home");
            }
        });
    });
}

function logout() {
    localStorage.removeItem("currentUser");
    updateUserBox();
    showPage("home");
}

function getCurrentUser() {
    var text = localStorage.getItem("currentUser");
    if (text == null) return null;
    return JSON.parse(text);
}

function updateUserBox() {
    var user = getCurrentUser();
    var box = document.getElementById("userBox");
    if (user == null) {
        box.innerHTML = "Chưa đăng nhập";
        document.getElementById("menuLogin").className = "";
        document.getElementById("menuDashboard").className = "hidden";
        return;
    }
    var roleName = "Khách hàng";
    if (user.role == "admin") roleName = "Quản trị";
    if (user.role == "staff") roleName = "Nhân viên";
    box.innerHTML = "Xin chào " + user.fullName + " (" + roleName + ") "
        + '<a href="#" id="btnLogout">Đăng xuất</a>';
    document.getElementById("btnLogout").onclick = function (e) {
        e.preventDefault();
        logout();
    };
    document.getElementById("menuLogin").className = "hidden";
    if (user.role == "admin") {
        document.getElementById("menuDashboard").className = "";
    } else {
        document.getElementById("menuDashboard").className = "hidden";
    }
}

function showDashboard() {
    var box = document.getElementById("dashboardBox");
    var user = getCurrentUser();
    if (user == null || user.role != "admin") {
        box.innerHTML = '<p class="msg error">Chỉ tài khoản admin mới xem được Dashboard.</p>';
        return;
    }
    loadFile("../data/carts.xml", function (cartText) {
        loadFile("../data/employees.json", function (empText) {
            loadFile("../data/customers.json", function (cusText) {
                getProductsDoc(function (productDoc) {
                    var products = productDoc.getElementsByTagName("product");
                    var totalStock = 0;
                    for (var i = 0; i < products.length; i++) {
                        totalStock += Number(getText(products[i], "stock"));
                    }
                    var carts = new DOMParser().parseFromString(cartText, "text/xml").getElementsByTagName("cart");
                    var revenue = 0;
                    for (var j = 0; j < carts.length; j++) {
                        if (getText(carts[j], "status") == "Đã thanh toán") {
                            revenue += Number(getText(carts[j], "total"));
                        }
                    }
                    box.innerHTML = '<div class="stat">Sản phẩm<b>' + products.length + "</b></div>"
                        + '<div class="stat">Tổng tồn kho<b>' + totalStock + "</b></div>"
                        + '<div class="stat">Nhân viên<b>' + JSON.parse(empText).length + "</b></div>"
                        + '<div class="stat">Khách hàng<b>' + JSON.parse(cusText).length + "</b></div>"
                        + '<div class="stat">Hóa đơn<b>' + carts.length + "</b></div>"
                        + '<div class="stat">Doanh thu đã thanh toán<b>$' + revenue.toFixed(2) + "</b></div>";
                });
            });
        });
    });
}

window.onload = function () {
    var links = document.querySelectorAll("#menu a");
    for (var i = 0; i < links.length; i++) {
        links[i].onclick = function (e) {
            e.preventDefault();
            showPage(this.getAttribute("data-page"));
        };
    }

    document.getElementById("loginForm").onsubmit = login;

    updateUserBox();
};
