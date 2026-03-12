;; emacs-macos.el
;; Basic sensible default mappings for demonstration purposes

(global-set-key (kbd "C-x C-s") 'save-buffer)
(global-set-key (kbd "C-x C-c") 'save-buffers-kill-terminal)
(global-set-key (kbd "C-x C-f") 'find-file)
(global-set-key (kbd "C-x b") 'switch-to-buffer)
(global-set-key (kbd "C-s") 'isearch-forward)
(global-set-key (kbd "C-r") 'isearch-backward)
(global-set-key (kbd "M-x") 'execute-extended-command)
(global-set-key (kbd "C-g") 'keyboard-quit)
(global-set-key (kbd "M-w") 'kill-ring-save)
(global-set-key (kbd "C-w") 'kill-region)
(global-set-key (kbd "C-y") 'yank)
