const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false }
}, { timestamps: true });

// 🔹 تشفير كلمة المرور قبل حفظ المستخدم في قاعدة البيانات
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    // نتأكد إن الباسورد مش مشفر أصلاً (يعني مش بيبدأ بـ $2b$)
    if (this.password && !this.password.startsWith('$2b$')) {
        try {
            const salt = await bcrypt.genSalt(10);
            this.password = await bcrypt.hash(this.password, salt);
            next();
        } catch (err) {
            next(err);
        }
    } else {
        next();
    }
});

// 🔹 ميثود لمقارنة كلمة المرور عند تسجيل الدخول
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;