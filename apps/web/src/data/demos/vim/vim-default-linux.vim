" Vim Comprehensive Default Keymap Demonstration
" This file maps standard Vim behaviors explicitly to themselves
" using 'nnoremap' so the parser can extract and display them.

" --- Motion / Navigation (1-key) ---
nnoremap h h
nnoremap j j
nnoremap k k
nnoremap l l
nnoremap w w
nnoremap b b
nnoremap e e
nnoremap 0 0
nnoremap ^ ^
nnoremap $ $
nnoremap G G
nnoremap gg gg

" --- Editing (1-key) ---
nnoremap x x
nnoremap s s
nnoremap r r
nnoremap d d
nnoremap c c
nnoremap y y
nnoremap p p
nnoremap P P
nnoremap u u
nnoremap . .

" --- Insert Mode Entrance (1-key) ---
nnoremap i i
nnoremap I I
nnoremap a a
nnoremap A A
nnoremap o o
nnoremap O O

" --- Searching ---
nnoremap / /
nnoremap ? ?
nnoremap n n
nnoremap N N
nnoremap * *
nnoremap # #

" --- Visual Mode ---
nnoremap v v
nnoremap V V
nnoremap <C-v> <C-v>

" --- Window Management ---
nnoremap <C-w>s <C-w>s
nnoremap <C-w>v <C-w>v
nnoremap <C-w>c <C-w>c
nnoremap <C-w>w <C-w>w
nnoremap <C-w>h <C-w>h
nnoremap <C-w>j <C-w>j
nnoremap <C-w>k <C-w>k
nnoremap <C-w>l <C-w>l

" --- Tab Management ---
nnoremap gt gt
nnoremap gT gT

" --- Saving and Quitting ---
nnoremap ZZ ZZ
nnoremap ZQ ZQ

" --- Advanced Motion ---
nnoremap % %
nnoremap { {
nnoremap } }
nnoremap ( (
nnoremap ) )

" --- Scrolling ---
nnoremap <C-f> <C-f>
nnoremap <C-b> <C-b>
nnoremap <C-d> <C-d>
nnoremap <C-u> <C-u>
nnoremap <C-e> <C-e>
nnoremap <C-y> <C-y>

" --- Macros ---
nnoremap q q
nnoremap @ @

" --- Formatting ---
nnoremap == ==
nnoremap << <<
nnoremap >> >>
nnoremap ~ ~

" --- System Clipboard ---
vnoremap "+y "+y
nnoremap "+p "+p

" --- Explicit Commands ---
nnoremap :w :write<CR>
nnoremap :q :quit<CR>
nnoremap :wq :wq<CR>
