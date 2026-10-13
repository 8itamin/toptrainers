from toptrainers_api.modules.assignments.crm_summary import completion_percent


def test_zero_denominator_is_null():
    assert completion_percent(0, 0) is None
    assert completion_percent(2, 4) == 50
