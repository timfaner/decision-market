const Voter = require('./voter');

const voter = new Voter();
voter.recover_from_file('voter_data/4_10_GRPIJUKDUR.json');
console.log(voter);
