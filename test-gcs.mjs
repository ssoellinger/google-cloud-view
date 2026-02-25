/**
 * Integration test for GcsClient against MinIO.
 * Run: node test-gcs.mjs
 */
import { createHmac } from 'crypto';
import { XMLParser } from 'fast-xml-parser';

const config = {
  serviceUrl: 'http://localhost:9000/',
  bucketName: 'test-bucket',
  accessId: 'minioadmin',
  secret: 'minioadmin',
  basePath: '',
  timeout: 30000,
};

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });

function signRequest(method, canonicalResource, contentMd5 = '', contentType = '', date, canonicalizedAmzHeaders) {
  if (!date) date = new Date().toUTCString();
  const stringToSign = canonicalizedAmzHeaders
    ? `${method}\n${contentMd5}\n${contentType}\n${date}\n${canonicalizedAmzHeaders}\n${canonicalResource}`
    : `${method}\n${contentMd5}\n${contentType}\n${date}\n${canonicalResource}`;
  const hmac = createHmac('sha1', config.secret);
  hmac.update(stringToSign, 'utf8');
  return `AWS ${config.accessId}:${hmac.digest('base64')}`;
}

async function sendRequest(method, url, canonicalResource, body, contentType = '', amzHeaders) {
  const date = new Date().toUTCString();
  let canonicalizedAmzHeaders;
  if (amzHeaders && Object.keys(amzHeaders).length > 0) {
    canonicalizedAmzHeaders = Object.entries(amzHeaders).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join('\n');
  }
  const authorization = signRequest(method, canonicalResource, '', contentType, date, canonicalizedAmzHeaders);
  const headers = { Authorization: authorization, Date: date };
  if (amzHeaders) Object.assign(headers, amzHeaders);
  if (contentType && body) headers['Content-Type'] = contentType;
  const res = await fetch(url, { method, headers, body: body ?? undefined });
  return res;
}

let pass = 0;
let fail = 0;

function assert(condition, msg) {
  if (condition) { pass++; console.log(`  PASS: ${msg}`); }
  else { fail++; console.error(`  FAIL: ${msg}`); }
}

async function run() {
  console.log('=== GCS Client Integration Tests (MinIO) ===\n');

  // 1. Upload a file
  console.log('1. Upload test.txt');
  const content = Buffer.from('Hello, Google Cloud View!');
  const uploadUrl = `${config.serviceUrl}${config.bucketName}/test-folder/test.txt`;
  const uploadCanonical = `/${config.bucketName}/test-folder/test.txt`;
  let res = await sendRequest('PUT', uploadUrl, uploadCanonical, content, 'text/plain');
  assert(res.ok, `Upload returned ${res.status}`);

  // 2. Upload a second file
  console.log('2. Upload another.json');
  const content2 = Buffer.from('{"key":"value"}');
  const url2 = `${config.serviceUrl}${config.bucketName}/test-folder/another.json`;
  const can2 = `/${config.bucketName}/test-folder/another.json`;
  res = await sendRequest('PUT', url2, can2, content2, 'application/json');
  assert(res.ok, `Upload returned ${res.status}`);

  // 3. Create folder placeholder
  console.log('3. Create subfolder');
  const folderUrl = `${config.serviceUrl}${config.bucketName}/test-folder/subfolder/`;
  const folderCan = `/${config.bucketName}/test-folder/subfolder/`;
  res = await sendRequest('PUT', folderUrl, folderCan, Buffer.alloc(0), 'application/x-directory');
  assert(res.ok, `Create folder returned ${res.status}`);

  // 4. List with delimiter (folder view)
  console.log('4. List folders at test-folder/');
  const listUrl = `${config.serviceUrl}${config.bucketName}/?list-type=2&max-keys=1000&delimiter=/&prefix=${encodeURIComponent('test-folder/')}`;
  const listCan = `/${config.bucketName}/`;
  res = await sendRequest('GET', listUrl, listCan);
  const listXml = await res.text();
  const listDoc = parser.parse(listXml);
  const root = listDoc.ListBucketResult;

  const contents = root.Contents ? (Array.isArray(root.Contents) ? root.Contents : [root.Contents]) : [];
  const prefixes = root.CommonPrefixes ? (Array.isArray(root.CommonPrefixes) ? root.CommonPrefixes : [root.CommonPrefixes]) : [];
  console.log(`   Objects: ${contents.map(c => c.Key).join(', ')}`);
  console.log(`   Folders: ${prefixes.map(p => p.Prefix).join(', ')}`);
  assert(contents.length === 2, `Got ${contents.length} objects (expected 2)`);
  assert(prefixes.length === 1, `Got ${prefixes.length} folders (expected 1)`);

  // 5. Download
  console.log('5. Download test.txt');
  const dlUrl = `${config.serviceUrl}${config.bucketName}/test-folder/test.txt`;
  const dlCan = `/${config.bucketName}/test-folder/test.txt`;
  res = await sendRequest('GET', dlUrl, dlCan);
  const downloaded = await res.text();
  assert(downloaded === 'Hello, Google Cloud View!', `Content matches: "${downloaded}"`);

  // 6. HEAD (file exists)
  console.log('6. Check file exists (HEAD)');
  res = await sendRequest('HEAD', dlUrl, dlCan);
  assert(res.status === 200, `HEAD returned ${res.status}`);

  // 7. HEAD non-existent
  console.log('7. Check non-existent file (HEAD)');
  const noUrl = `${config.serviceUrl}${config.bucketName}/nope.txt`;
  const noCan = `/${config.bucketName}/nope.txt`;
  res = await sendRequest('HEAD', noUrl, noCan);
  assert(res.status === 404, `HEAD returned ${res.status} for missing file`);

  // 8. Copy
  console.log('8. Copy test.txt -> test-copy.txt');
  const copyUrl = `${config.serviceUrl}${config.bucketName}/test-folder/test-copy.txt`;
  const copyCan = `/${config.bucketName}/test-folder/test-copy.txt`;
  const copySource = `/${config.bucketName}/test-folder/test.txt`;
  res = await sendRequest('PUT', copyUrl, copyCan, null, '', { 'x-amz-copy-source': copySource });
  assert(res.ok, `Copy returned ${res.status}`);

  // Verify copy
  res = await sendRequest('GET', copyUrl, copyCan);
  const copyContent = await res.text();
  assert(copyContent === 'Hello, Google Cloud View!', `Copied content matches`);

  // 9. Delete
  console.log('9. Delete test-copy.txt');
  res = await sendRequest('DELETE', copyUrl, copyCan);
  assert(res.ok || res.status === 204, `Delete returned ${res.status}`);

  // Verify deleted
  res = await sendRequest('HEAD', copyUrl, copyCan);
  assert(res.status === 404, `Deleted file returns 404`);

  // 10. Move (copy + delete)
  console.log('10. Move test.txt -> moved.txt');
  const moveDestUrl = `${config.serviceUrl}${config.bucketName}/test-folder/moved.txt`;
  const moveDestCan = `/${config.bucketName}/test-folder/moved.txt`;
  // Copy
  res = await sendRequest('PUT', moveDestUrl, moveDestCan, null, '', { 'x-amz-copy-source': `/${config.bucketName}/test-folder/test.txt` });
  assert(res.ok, `Move-copy returned ${res.status}`);
  // Delete original
  res = await sendRequest('DELETE', dlUrl, dlCan);
  assert(res.ok || res.status === 204, `Move-delete returned ${res.status}`);
  // Verify
  res = await sendRequest('HEAD', dlUrl, dlCan);
  assert(res.status === 404, `Original gone after move`);
  res = await sendRequest('GET', moveDestUrl, moveDestCan);
  const movedContent = await res.text();
  assert(movedContent === 'Hello, Google Cloud View!', `Moved content matches`);

  // Summary
  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });
