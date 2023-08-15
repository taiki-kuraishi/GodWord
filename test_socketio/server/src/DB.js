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
        const query_1 = 'SELECT * FROM godwordtable limit 10'; // あなたのテーブル名に置き換える
        const result_1 = await client.query(query_1);

        console.log('Database Contents:');
        console.log('id, title, length');
        for (const row of result_1.rows) {
            console.log(`${row.id}, ${row.title}, ${row.length}`);
        }

        const query_2 = 'select count(*) from godwordtable;';
        const result_2 = await client.query(query_2); // query_2 に修正
        console.log('DB length');
        console.log(result_2.rows[0].count); // 結果からカウントを取得

    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        client.end();
    }
});
