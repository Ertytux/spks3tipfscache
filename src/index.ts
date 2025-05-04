import express from 'express';
import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';



// client S3
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// 3. Example upload a folder
async function uploadFolderToS3(localPath: string, bucketName: string) {
    const queue: { path: string, s3Prefix: string }[] = [{ path: localPath, s3Prefix: '' }];

    while (queue.length > 0) {
        const current = queue.pop();
        if (!current) continue;

        const items = fs.readdirSync(current.path);

        await Promise.all(items.map(async (item) => {
            const fullPath = path.join(current.path, item);
            const stats = fs.statSync(fullPath);
            const relativePath = path.relative(localPath, fullPath);
            const s3Key = path.join(current.s3Prefix, relativePath).replace(/\\/g, '/');

            if (stats.isFile()) {
                const fileStream = fs.createReadStream(fullPath);
                await s3.putObject({
                    Bucket: bucketName,
                    Key: s3Key,
                    Body: fileStream
                }).promise();
                console.log(`Subido: ${s3Key}`);
            } else if (stats.isDirectory()) {
                queue.push({ path: fullPath, s3Prefix: current.s3Prefix });
            }
        }));
    }
}

// Express Server
const app = express();
app.use(express.json());

app.post('/upload-folder', (async (
    req: express.Request<{}, {}, { localPath: string; bucketName: string }>,
    res: express.Response
  ) => {
    try {
        const { localPath, bucketName } = req.body;

        if (!localPath || !bucketName) {
            return res.status(400).json({ error: 'Parámetros requeridos faltantes' });
        }

        await uploadFolderToS3(localPath, bucketName);
        res.json({ message: 'Carpeta subida exitosamente' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error al subir la carpeta' });
    }
}) as express.RequestHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});