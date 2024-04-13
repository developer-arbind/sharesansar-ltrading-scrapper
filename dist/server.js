"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const mongoose_1 = __importDefault(require("mongoose"));
let browser = null;
let tableModel;
const tableSchema = new mongoose_1.default.Schema({
    companies: [
        {
            name: String,
            LTP: Number,
            rank: Number
        }
    ]
});
const makeDB = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let db = yield mongoose_1.default.createConnection("mongodb+srv://codingarbind:mynameisarbind@arbind.7wex6sm.mongodb.net/trading_money");
        console.log("connection success: ");
        return db;
    }
    catch (err) {
        console.log(err);
    }
});
const makeSQL = () => __awaiter(void 0, void 0, void 0, function* () {
    const db = yield makeDB();
    tableModel = db.model("tables", tableSchema);
    console.log("json: ", tableModel);
});
const app = (0, express_1.default)();
app.use(express_1.default.json());
const site_url = "https://www.sharesansar.com/live-trading";
const corsOption = {
    origin: "*",
    methods: ["POST", "GET"]
};
const launchBrowser = () => __awaiter(void 0, void 0, void 0, function* () {
    if (!browser) {
        browser = yield puppeteer_1.default.launch();
    }
    ;
    return browser;
});
app.use((0, cors_1.default)(corsOption));
app.use(body_parser_1.default.json());
const server = http_1.default.createServer(app);
makeSQL();
app.post("/extract_data", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const browser = yield launchBrowser();
    const page = yield browser.newPage();
    yield page.goto(site_url);
    const gotoColumn = yield page.evaluate(() => {
        var _a, _b, _c;
        function convertToPlaneNumber(formattedNumber) {
            let plainNumber = formattedNumber.replace(/,/g, '');
            return parseFloat(plainNumber);
        }
        let tables = document.querySelectorAll('table');
        let tbody = tables[1].querySelector('tbody');
        let tr = tbody.querySelectorAll('tr');
        let N = tr.length;
        let data = {};
        let previousCompany = "";
        for (let i = 0; i < N; i++) {
            let tds = tr[i].querySelectorAll('td');
            for (let j = 0; j < tds.length; j++) {
                let childNodes = (_a = tds[j]) === null || _a === void 0 ? void 0 : _a.childNodes;
                if (childNodes.length > 1) {
                    data[childNodes[1].textContent] = {
                        rank: Number((_c = (_b = tds[j - 1]) === null || _b === void 0 ? void 0 : _b.childNodes[0]) === null || _c === void 0 ? void 0 : _c.textContent.trim()),
                        LTP: 0
                    };
                    previousCompany = childNodes[1].textContent;
                }
                else {
                    if (!tds[j].classList.contains("sorting_1")) {
                        data[previousCompany].LTP = convertToPlaneNumber(tds[j].childNodes[0].textContent.trim());
                        break;
                    }
                    //skip
                }
            }
            ;
            previousCompany = "";
        }
        return data;
    });
    const tableDatabaseFormat = {
        companies: []
    };
    for (let key in gotoColumn) {
        tableDatabaseFormat.companies.push({
            name: key,
            rank: gotoColumn[key].rank,
            LTP: gotoColumn[key].LTP
        });
    }
    console.log("table data: ", gotoColumn, tableDatabaseFormat);
    let data = new tableModel({
        companies: tableDatabaseFormat.companies
    });
    yield data.save();
    console.log("ending data: ", data);
    res.status(200).json({
        message: "success",
        code: 200
    });
}));
server.listen(8001, () => console.log("server running in port 8001"));
//# sourceMappingURL=server.js.map