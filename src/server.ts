import express, { Request, Response } from "express";
import http from "http";
import bodyParser from "body-parser";
import cors from "cors";
import puppeteer, { Browser, Puppeteer } from "puppeteer";
import mongoose from "mongoose";

let browser: Browser | null = null;

interface Table {
    companies: Array<{
        rank: number,
        name: string,
        LTP: number,
    }>
}

let tableModel: mongoose.Model<Table>;

const tableSchema = new mongoose.Schema<Table>({
    companies: [
        {
            name: String,
            LTP: Number,
            rank: Number
        }
    ]
});

const makeDB = async () => {
    try {
        let db = await mongoose.createConnection("URL");
        console.log("connection success: ");
        return db;
    } catch (err: any) {
        console.log(err);
    }
};

const makeSQL = async () => {
    const db = await makeDB();
    tableModel = db!.model("tables", tableSchema);

    console.log("json: ", tableModel);
};

const app = express();
app.use(express.json());

const site_url = "https://www.sharesansar.com/live-trading";

const corsOption = {
    origin: "*",
    methods: ["POST", "GET"]
};

const launchBrowser = async (): Promise<Browser> => {
    if (!browser) {
        browser = await puppeteer.launch();
    }

    return browser;
};

app.use(cors(corsOption));
app.use(bodyParser.json());
const server = http.createServer(app);
makeSQL();

app.post("/extract_data", async (req: Request, res: Response) => {
    const browser = await launchBrowser();
    const page = await browser.newPage();

    await page.goto(site_url);

    const gotoColumn = await page.evaluate(() => {
        function convertToPlaneNumber(formattedNumber: string) {
            let plainNumber = formattedNumber.replace(/,/g, '');
            return parseFloat(plainNumber);
        }

        let tables = document.querySelectorAll('table');
        let tbody = tables[1].querySelector('tbody');
        let tr = tbody!.querySelectorAll('tr');
        let N = tr.length;
        let data: { [key: string]: { rank: number; LTP: number } } = {};
        let previousCompany: string | null = "";
        for (let i = 0; i < N; i++) {
            let tds = tr[i].querySelectorAll('td');
            for (let j = 0; j < tds.length; j++) {
                let childNodes = tds[j]?.childNodes;

                if (childNodes && childNodes.length > 1 && childNodes[1].textContent) {
                    data[childNodes[1].textContent as keyof typeof data] = {
                        rank: Number(tds[j - 1]?.childNodes[0]?.textContent?.trim()) || 0,
                        LTP: 0
                    };
                    previousCompany = childNodes[1].textContent as string;
                } else {
                    if (!tds[j].classList.contains("sorting_1")) {
                        data[previousCompany as keyof typeof data].LTP = convertToPlaneNumber(tds[j]?.childNodes[0]?.textContent?.trim() || '');
                        break;
                    }
                }
            };
            previousCompany = "";
        }
        return data as { [key: string]: { rank: number; LTP: number } }
    });

    const tableDatabaseFormat: Table = {
        companies: []
    };

    for (let key in gotoColumn) {
        tableDatabaseFormat.companies.push({
            name: key,
            rank: gotoColumn[key as keyof typeof gotoColumn].rank as number,
            LTP: gotoColumn[key as keyof typeof gotoColumn].LTP as number
        });
    }

    await tableModel.collection.drop();

    console.log("table data: ", gotoColumn, tableDatabaseFormat);
    let data = new tableModel({
        companies: tableDatabaseFormat.companies
    });

    await data.save();

    console.log("ending data: ", data);

    res.status(200).json({
        message: "success",
        code: 200
    });
});

server.listen(8001, () => console.log("server running in port 8001"));