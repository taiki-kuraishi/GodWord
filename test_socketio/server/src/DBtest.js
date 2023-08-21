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
        const queryValue = "000";
        const query_1 = `select * from godwordtable where title = '${queryValue}';`;
        const result_1 = await client.query(query_1);

        if (result_1.rows[0]) {
            console.log("データが存在します。");
            for (const row of result_1.rows) {
                console.log(`${row.id}, ${row.title}, ${row.length}`);
            }
        } else {
            console.log("データは存在しません。");
        }
    } catch (err) {
        console.error('Error querying database:', err);
    } finally {
        client.end();
    }
});
