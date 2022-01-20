/* Javascript Program for Bad Character Heuristic of Boyer
Moore String Matching Algorithm */
let NO_OF_CHARS = 65535;

// A utility function to get maximum of two integers
function max(a, b) {
  return (a > b) ? a : b;
}

// The preprocessing function for Boyer Moore's
// bad character heuristic
function badCharHeuristic(str, size, badchar) {
  // Initialize all occurrences as -1
  for (let i = 0; i < NO_OF_CHARS; i++)
    badchar[i] = -1;

  // Fill the actual value of last occurrence
  // of a character (indices of table are ascii and values are index of occurrence)
  for (i = 0; i < size; i++)
    badchar[str[i].charCodeAt(0)] = i;

}

/* A pattern searching function that uses Bad
     Character Heuristic of Boyer Moore Algorithm */
function searchh(txt, pat) {
  let found = false;
  let m = pat.length;
  let n = txt.length;
  var tokens = txt;
  let badchar = new Array(NO_OF_CHARS);
  var search_position = 0;

  /* Fill the bad character array by calling
     the preprocessing function badCharHeuristic()
     for given pattern */
  badCharHeuristic(pat, m, badchar);
  let s = 0; // s is shift of the pattern with
  // respect to text
  // there are n-m+1 potential allignments
  while (s <= (n - m)) {
    let j = m - 1;

    /* Keep reducing index j of pattern while
       characters of pattern and text are
       matching at this shift s */
    while (j >= 0 && pat[j] == txt[s + j])
      j--;

    /* If the pattern is present at current
       shift, then index j will become -1 after
       the above loop */
    if (j < 0) {
      var search_position = s;
      var count=0;
    while(count<pat.length){
        tokens[search_position] = '<span class="highlight">' + tokens[search_position] + '</span>';
        count+=1;
        search_position+=1;
        found = true;
  }
      
      /* Shift the pattern so that the next
         character in text aligns with the last
         occurrence of it in pattern.
         The condition s+m < n is necessary for
         the case when pattern occurs at the end
         of text */
      //console.log(txt[s+m])// is character after the pattern in text
      s += (s + m < n) ? m - badchar[txt[s + m].charCodeAt(0)] : 1;

    } else
      /* Shift the pattern so that the bad character
         in text aligns with the last occurrence of
         it in pattern. The max function is used to
         make sure that we get a positive shift.
         We may get a negative shift if the last
         occurrence  of bad character in pattern
         is on the right side of the current
         character. */
      s += max(1, j - badchar[txt[s + j].charCodeAt(0)]);
  }
if(found) return tokens.join('');
  else return false;

}

/* Driver program to test above function */


// This code is contributed by unknown2108