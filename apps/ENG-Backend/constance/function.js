const fs = require("fs");
const path = require('path');

const padWithLeadingZeros = (num, totalLength) => {
    return String(num).padStart(totalLength, '0');
}

const deleteAllFilesInDir = async (dirPath) => {
    try {
        fs.readdirSync(dirPath).forEach(file => {
            fs.rmSync(path.join(dirPath, file));
        });
    } catch (error) {
        console.log(error);
    }
}

module.exports = { 
    padWithLeadingZeros,
    deleteAllFilesInDir
};