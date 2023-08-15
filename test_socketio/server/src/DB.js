import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "PASSWORD",
    database: "GodWord"
});

client.connect(async (err) => {
    if (err) throw err;
    console.log('PostgreSQL Connected...');

    try {
        const query = 'SELECT * FROM godwordtable'; // あなたのテーブル名に置き換える
        const result = await client.query(query);

        console.log('Database Contents:');
        console.log('id, title, length');
        for (const row of result.rows) {
            console.log(`${row.id}, ${row.title}, ${row.length}`);
        }
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        client.end();
    }
});
