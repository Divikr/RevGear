const islogin = (req, res, next) => {
    if (req.session.user) {
        next;
    }
    return res.redirect('/home');
}

const islogout = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/login');
    }
    return next();
}

module.exports = {
    islogin,
    islogout
}