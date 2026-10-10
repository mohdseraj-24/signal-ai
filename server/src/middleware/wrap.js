// Express 4 async handlers ke errors ko error middleware tak pahunchata hai (crash se bachata hai)
export const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
