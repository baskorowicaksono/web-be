import multer from 'multer'

const storage = multer.memoryStorage()
export const uploadSectorFile = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet') ||
        file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true)
    } else {
      cb(new Error('Only Excel files are allowed'))
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
}).single('file')