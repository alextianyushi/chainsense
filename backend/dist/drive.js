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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFileFromMemory = uploadFileFromMemory;
exports.downloadFileFromAutoDrive = downloadFileFromAutoDrive;
// src/drive.ts
const auto_drive_1 = require("@autonomys/auto-drive");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const api = (0, auto_drive_1.createAutoDriveApi)({ apiKey: process.env.AUTODRIVE_API_KEY });
/**
 * Upload user chat records to Auto Drive
 * @param chatRecords The full chat record buffer
 * @param filename The name of the file to be uploaded
 * @param password Optional encryption password
 * @param userId The ID of the user (UUID or wallet address)
 * @returns The CID of the uploaded file
 */
function uploadFileFromMemory(chatRecords, filename, password, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!userId.startsWith("0x")) {
            throw new Error("Wallet connection required to upload files.");
        }
        const userChat = chatRecords[userId];
        if (!userChat) {
            throw new Error(`No chat records found for userId: ${userId}`);
        }
        const content = {
            userId,
            messages: userChat.messages,
            timestamp: new Date().toISOString(),
        };
        const buffer = Buffer.from(JSON.stringify(content, null, 2), 'utf-8');
        const genericFile = {
            read: function () { return __asyncGenerator(this, arguments, function* () { yield yield __await(buffer); }); },
            name: filename,
            mimeType: 'application/json',
            size: buffer.length,
            path: filename,
        };
        const options = {
            password,
            compression: true,
            onProgress: (progress) => console.log(`Upload progress: ${progress}%`),
        };
        try {
            const cid = yield (0, auto_drive_1.uploadFile)(api, genericFile, options);
            return cid;
        }
        catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    });
}
/**
 * Download a file from Auto Drive
 * @param cid The CID of the file
 * @param password Optional decryption password
 * @returns The file content
 */
function downloadFileFromAutoDrive(cid, password) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        try {
            const stream = yield (0, auto_drive_1.downloadFile)(api, cid, password);
            let fileBuffer = Buffer.alloc(0);
            try {
                for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _d = true) {
                    _c = stream_1_1.value;
                    _d = false;
                    const chunk = _c;
                    fileBuffer = Buffer.concat([fileBuffer, chunk]);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            const fileContent = fileBuffer.toString('utf-8');
            return JSON.parse(fileContent);
        }
        catch (error) {
            console.error('Download failed:', error);
            throw error;
        }
    });
}
