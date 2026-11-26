ALTER TABLE assistant_proposal
  DROP CONSTRAINT IF EXISTS assistant_proposal_action_check;

ALTER TABLE assistant_proposal
  ADD CONSTRAINT assistant_proposal_action_check
  CHECK(action IN ('add_to_cart','remove_cart_line','set_cart_quantity','clear_cart'));
