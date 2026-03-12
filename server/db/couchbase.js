const couchbase = require('couchbase');

let cluster, bucket, collection;

async function connectDB() {
  if (collection) return collection;

  try {
    cluster = await couchbase.connect(process.env.COUCHBASE_CONNECTION_STRING, {
      username: process.env.COUCHBASE_USERNAME,
      password: process.env.COUCHBASE_PASSWORD,
      timeoutOptions: {
        kvTimeout: 10000,
        queryTimeout: 10000,
        connectTimeout: 20000,
      },
    });

    bucket = cluster.bucket(process.env.COUCHBASE_BUCKET);
    collection = bucket.defaultCollection();

    console.log('✅ Connected to Couchbase');
    return collection;
  } catch (err) {
    console.error('❌ Couchbase connection error:', err.message);
    throw err;
  }
}

async function getCluster() {
  if (!cluster) await connectDB();
  return cluster;
}

module.exports = { connectDB, getCluster };
