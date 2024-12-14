const islogin = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/home');
    }
    return next();
}

const islogout = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/home');
    }
    return next();
}

module.exports = {
    islogin,
    islogout
}